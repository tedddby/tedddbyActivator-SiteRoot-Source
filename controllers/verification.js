const env = require("dotenv");
const request = require("request");
const jwt = require("jsonwebtoken");
const ms_pricing = require("./pricing");
const fetch = require("node-fetch");

env.config({
    path:"./sec.env"
});

const envData = process.env;
const promisify = f => (...args) => new Promise((a,b)=>f(...args, (err, res) => err ? b(err) : a(res)));

const VerifySerial = (req, res) => {
    const serial = req.originalUrl.replace("/verification/serial/", "");

    if(serial == "" && serial.length != 15 && serial.includes("-") == false){
        console.log()
        return res.status(401).json({status:"invalid serial number"})
    }else{
        const identifier = serial.split("-")[0];
        var url;
        var service;
        var jwtService;
        var price;
        switch(identifier){
            case "GS":
                url = "https://api.ifreeicloud.co.uk";
                service = "GsmBypass";
                jwtService = "GSM Bypass";
                price = 10;
            break;

            case "ME":
                url = "https://api.ifreeicloud.co.uk";
                service = "MEIDBypass";
                jwtService = "MEID Bypass";
                price = 7;
            break;

            case "MS":
                url = "https://api.ifreeicloud.co.uk";
                service = "MEID/GSM Bypass With Signal";
                jwtService = "MEID/GSM Bypass With Signal";
                price = 222;
            break;

            case "MD":
                url = "https://api.ifreeicloud.co.uk";
                service = "MDMBypass";
                jwtService = "MDM Bypass";
                price = 10;
            break;

            default:
                url = null;
                service = 0;
        }

        if(url == null || service == 0){
            return res.status(401).json({status:"unknow service"});
        }else{
        if(identifier !== "MS"){
            request.post(url, {
                form:{
                    key:envData.iFreeKey,
                    service:0,
                    imei:serial.split("-")[1]
                }
            },
            (error, response, data) => {
                if(error){
                    return res.status(500).json({status:"server error"});
                }else{
                    if(response.statusCode === 200){
                        var parsed = JSON.parse(data);
                        var finalRes;
                        var type;
                        var token;

                        if(parsed.success == true){
                            var model = parsed.object.model;
                            if(model.includes("iPhone 5") || model.includes("iPhone 6") || model.includes("iPhone 11") || model.includes("iPhone 12")){
                                type = "MEID";
                            }else{
                                type = "GSM";
                            }

                            finalRes = {
                                serial:parsed.object.serial,
                                model:parsed.object.model,
                                type:type,
                                status:"success"
                            }

                            token = jwt.sign({
                                Service:jwtService,
                                SerialNumber:serial.split("-")[1],
                                Price:price,
                                Model:parsed.object.model,
                                Type:type
                            }, 
                            envData.jwtKey,
                            {
                                expiresIn:"1h"
                            });

                        }else{
                            finalRes = {status:"failed"}
                            token = null
                        }
                        if(token != null){
                            res.cookie("checkout", token, {
                             expires: new Date(Date.now() + 60 * 60 * 1000),
                             httpOnly: true
                            })
                        }
                        return res.status(200).json(finalRes);
                    }else{
                        return res.status(403).send("Contact site Admin");
                    }
                }
            })
        }else{

            //== M E I D -- S I G N A L ==//

            request.post({
                url:url,
                form:{
                    key:envData.iFreeKey,
                    service:0,
                    imei:serial.split("-")[1]
                }
            }, (err, resp, body) => {
                if(err){
                    return res.status(500).json({
                        status:"server error"
                    })
                }else{
                    if(resp.statusCode !== 200){
                        return res.status(resp.statusCode).json({
                            status:"request rejected"
                        });
                    }else{
                        var obj = JSON.parse(body); //var parsed = JSON.parse(data);
                        var finalResp;
                        var token;

                        if(obj.success == true){
                              finalResp = {
                                serial:obj.object.serial,
                                model:obj.object.model,
                                type:"MEID/GSM",
                                status:"success"
                            }

                            token = jwt.sign({
                                Service:jwtService,
                                SerialNumber:serial.split("-")[1],
                                Price:ms_pricing.setPrice(obj.object.model),
                                Model:obj.object.model,
                                Type:"MEID/GSM"
                            }, 
                            envData.jwtKey,
                            {
                                expiresIn:"1h"
                            });
                        }else{
                            finalResp = {status: "failed"};
                        }
                        res.cookie("checkout", token, {
                            expires:new Date(Date.now() + 60 * 60 * 1000),
                            httpOnly:true
                        });
                        return res.status(200).json(finalResp);
                    }
                }
            })
        }
    }
    }

}

const VerifyCheckout = async (req, res, next) => {
    if(req.cookies.checkout){
        try{
            const decoded = await promisify(jwt.verify)(req.cookies.checkout, envData.jwtKey);
            req.serial = decoded.SerialNumber;
            req.service = decoded.Service;
            req.price = decoded.Price;
            req.model = decoded.Model;
            req.type = decoded.Type;

            if(decoded.Service == "MEID/GSM Bypass With Signal"){
                const iremovalCheck = await fetch(`https://s13.iremovalpro.com/API/tedcheck.php?SerialNumber=${decoded.SerialNumber}&apiKey=${envData.iRemovalProAPI}`, {
                    method:"GET"
                })
                .then(res => res.text())
                .then(data => {
                    var x = "";
                    switch(data){
                        case "Device not checked yet":
                            x = "Not checked with iRemoval";
                        break;

                        case "Device not supported":
                            x = "Device Not Supported";
                        break;

                        case "Device already registered":
                            x = "Device Already Registered";
                        break;

                        case "Device supported":
                            x = "Device SUPPORTED";
                        break;

                        default:
                            x = "Check Failed";
                        break;
                    }
                    return x;
                })
                .catch(e => {
                    return e;
                });

                req.iremoval = iremovalCheck;

                token = jwt.sign({
                    Service:decoded.Service,
                    SerialNumber:decoded.SerialNumber,
                    Price:decoded.Price,
                    Model:decoded.Model,
                    Type:decoded.Type,
                    iremoval: iremovalCheck
                }, 
                envData.jwtKey,
                {
                    expiresIn:"1h"
                });

                res.cookie("checkout", token, {
                    expires:new Date(Date.now() + 60 * 60 * 1000),
                    httpOnly:true
                });
            }
            next();
        }catch{
            next();
        }
    }else{
        next();
    }
}

module.exports = {VerifySerial, VerifyCheckout}