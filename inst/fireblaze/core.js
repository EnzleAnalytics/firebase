// global variables
var ui, ui_opts;
var ui_initialised = false;
var db;

window.state = {
  initialised: false,
  update() {
    console.log(`Fireblaze initialized: ${this.initialised}`);
  },
  get pageNumber() {
    return this.initialised;
  },
  set pageNumber(init) {
    this.initialised = init;
    this.update(this.initialised);
  }
};

// Initialise
Shiny.addCustomMessageHandler('fireblaze-initialize', function(msg) {

  if(!window.state.initialised){
    window.state.initialised = true;
    // init
    firebase.initializeApp(msg.conf);
	db = firebase.firestore();
	
	var jQueryScript = document.createElement('script');  
	jQueryScript.setAttribute('src','https://www.gstatic.com/firebasejs/8.7.1/firebase-functions.js');
	document.head.appendChild(jQueryScript);

    // set persistence
    var persistence = persistenceOpts(msg.persistence);
    firebase.auth().setPersistence(persistence);

    firebase.auth().onAuthStateChanged(function(user) {
      if(user){

        // show signin authorised
        showHideOnLogin("show");
        showHideOnLogout("hide");
        $("#fireblaze-signin-ui").hide();

        // set input
        Shiny.setInputValue('fireblaze_' + 'signed_in', {success: true, response: user});
        Shiny.setInputValue('fireblaze_' + 'signed_in_user', {success: true, response: user});

      } else {

        // hide signin required
        showHideOnLogin("hide");
        showHideOnLogout("show");

        // set error input
        Shiny.setInputValue('fireblaze_' + 'signed_in', {success: false, response: null});
        Shiny.setInputValue('fireblaze_' + 'signed_in_user', {success: false, response: null});
      }
    });

    // check email verification link
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
      // Additional state parameters can also be passed via URL.
      // This can be used to continue the user's intended action before triggering
      // the sign-in operation.
      // Get the email if available. This should be available if the user completes
      // the flow on the same device where they started it.
      var email = window.localStorage.getItem('fireblazeEmailSignIn');
      if (!email) {
        Shiny.setInputValue('fireblaze_' + 'email_verification', {success: false, response: "Cannot find email"});
      }
      // The client SDK will parse the code from the link for you.
      firebase.auth().signInWithEmailLink(email, window.location.href)
        .then(function(result) {
          window.localStorage.removeItem('fireblazeEmailSignIn');
          Shiny.setInputValue('fireblaze_' + 'email_verification', {success: true, response: result});
        })
        .catch(function(error) {
          Shiny.setInputValue('fireblaze_' + 'email_verification', {success: false, response: error});
        });
    }

  }

});

// Config init
Shiny.addCustomMessageHandler('fireblaze-ui-config', function(msg) {

  if(!ui_initialised) {
    ui_initialised = true;
    ui = new firebaseui.auth.AuthUI(firebase.auth());
  }

  var providers = signinOpts(msg.providers);
  var helper = accountHelper(msg.account_helper);

  ui_opts = {
    callbacks: {
      signInSuccessWithAuthResult: function(authResult, redirectUrl){
        Shiny.setInputValue('fireblaze_' + 'signed_up_user', {success: true, response: firebase.auth().currentUser});
        return(false);
      },
      uiShown: function() {
        var loader = document.getElementById('loader');
        
        if(loader)
          loader.style.display = 'none';
      }
    },
    credentialHelper: helper,
    signInFlow: msg.flow,
    signInOptions: providers,
    tosUrl: msg.tos_url,
    privacyPolicyUrl: msg.privacy_policy_url
  };

  ui.start("#fireblaze-signin-ui", ui_opts);
});

// Sign out
Shiny.addCustomMessageHandler('fireblaze-signout', function(msg) {

  firebase.auth().signOut()
    .then(function() {
      if(ui_initialised){
        ui.start("#fireblaze-signin-ui", ui_opts);
        $("#fireblaze-signin-ui").show();
      }

      Shiny.setInputValue('fireblaze_' + 'signout', {success: true, response: 'successful'})
    }).catch(function(error) {
      Shiny.setInputValue('fireblaze_' + 'signout', {success: false, response: error})
    });

});

// Language code
Shiny.addCustomMessageHandler('fireblaze-language-code', function(msg) {
  firebase.auth().languageCode = msg.code;
});

// Delete User
Shiny.addCustomMessageHandler('fireblaze-delete-user', function(msg) {
  let user = firebase.auth().currentUser;

  user.delete()
    .then(function() {
      Shiny.setInputValue('fireblaze_' + 'deleted_user', {success: true, response: 'successful'})
    }).catch(function(error) {
      Shiny.setInputValue('fireblaze_' + 'deleted_user', {success: false, response: error})
    });
});

// Get a Stripe Checkout Session, pass back to Shiny
Shiny.addCustomMessageHandler('start-subscription', async function(price_id) {
	console.log('Initiate Subscription');
	
	const docRef = await db
	  .collection('customers')
	  .doc(firebase.auth().currentUser.uid)
	  .collection('checkout_sessions')
	  .add({
		price: price_id,
		success_url: window.location.origin,
		cancel_url: window.location.origin,
	  });
	  
	
	// Wait for the CheckoutSession to get attached by the extension
	// Could include redirect here
	docRef.onSnapshot((snap) => {
	  Shiny.setInputValue('userProfile_ui_1-stripe_url_response', snap.data());
	});
	
	
});

