const get = (id) => {
    return document.getElementById(id);
}

const updateCookie = (soldval) => {
  var cookieResponse = fetch("../fmi/modify/cookie/soldby", {
  method: "POST",
  body: JSON.stringify({
   soldby: soldval
  }),
  headers: {
    "Content-type": "application/json; charset=UTF-8"
  }
})
  .then((response) => response.json())
  .then((finalres) => {
    console.log(finalres);
  })
}

get("confirmCheck").addEventListener('change', function() {
    if (this.checked) {
      get("confirmCheck").checked = true;
    } else {
        get("confirmCheck").checked = false;
    }
});

///////////////////////////////////////////////////

var stripe = Stripe("pk_live_51JS5eFDJCYp3oML13Lkal4728vX0IVmjnsDoZNwdoDW1XWrCqkKiQazKLUR8pVNv58KIczOFomBUUtfhHopixu0c00blNmprAq");

get("payButton").addEventListener("click", () => {
    if(get("confirmCheck").checked == false){
        return alert(`Please check "I confirm this is my device" box to proceed to payment`);
    }
    fetch("../stripe/session", {method:"post"})
    .then(res => res.json())
    .then(data => {
        if(data.failed){
            alert("Security Token Missing From Your Request!");
            return false;
        }else{
            if(data.id){
                return stripe.redirectToCheckout({ sessionId: data.id });
            }else{
                return false;
            }
        }
    })
    .then(result => {
        if(result.error){
            return alert(result.error.message);
        }
    })
    .catch(err => {
        return alert("Server Error "+err);
    })
});

