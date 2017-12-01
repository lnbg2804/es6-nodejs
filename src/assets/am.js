try {
    if (Shopify.Checkout.page == "thank_you" || Shopify.Checkout.step == "thank_you") {
        document.body.setAttribute("style", "display:none");
        window.location.replace("https://" + window.location.hostname + "/app/am-secure")
        window.location.href = "/apps/am-secure";
    }
} catch (e) { }

try {
    if (Shopify.Checkout.step == "payment_method") {
        $(".step__footer__continue-btn").on("click", function(){ upsellCheckout(); });
    }
} catch (e) { }


try {
    var cart_template = document.getElementById("cart-template");
    if ($(cart_template) != undefined) {
        $('<a href="#addmore" onclick="addmoreitem()" style="margin-left: 10px;" class="btn btn--small btn--secondary cart__remove">Add more item</a>').insertAfter(".cart__meta .cart__remove");
    }
} catch (e) {

}

function addmoreitem() {
    alert("hello world")
}

function upsellCheckout(e) {
    e.preventDefault();
    window.location.href = "/apps/am-secure";
}
