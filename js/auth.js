// VIRALX auth — Supabase Auth (email/password) + profile creation on sign-up.
// Includes the password-recovery flow: reset email -> link back here ->
// "Set a new password" form -> updateUser -> signed in.
(function () {
  var sb = window.VX && window.VX.sb;
  var mode = "signin"; // signin | signup | recovery
  var errEl = document.getElementById("auth-error");
  var submit = document.getElementById("auth-submit");
  var sub = document.getElementById("auth-sub");
  var userField = document.getElementById("username-field");
  var emailField = document.getElementById("email-field");
  var emailInput = document.getElementById("email");
  var pwInput = document.getElementById("password");
  var pw2Field = document.getElementById("confirm-field");
  var pw2Input = document.getElementById("password2");
  var pwLabel = document.getElementById("password-label");
  var toggleRow = document.getElementById("auth-toggle").parentElement;

  if (!sb) document.getElementById("demo-note").classList.remove("hidden");

  function setMode(m) {
    mode = m;
    userField.classList.toggle("hidden", m !== "signup");
    submit.textContent = m === "signup" ? "Create account" : "Sign in";
    sub.textContent = m === "signup" ? "Create your account — free forever." : "Sign in to post, go live, and get paid.";
    document.getElementById("auth-toggle").textContent = m === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
    errEl.textContent = "";
  }

  function setRecovery() {
    if (mode === "recovery") return;
    mode = "recovery";
    document.querySelector(".card h1").textContent = "Set a new password";
    sub.textContent = "Type your new password below — you'll be signed in right after.";
    userField.classList.add("hidden");
    emailField.classList.add("hidden");
    emailInput.required = false;
    pwLabel.textContent = "New password";
    pwInput.setAttribute("autocomplete", "new-password");
    pwInput.value = "";
    pw2Field.classList.remove("hidden");
    toggleRow.classList.add("hidden");
    submit.textContent = "Set new password";
    errEl.style.color = "";
    errEl.textContent = "";
  }

  if (sb) {
    // Supabase fires PASSWORD_RECOVERY when the reset link lands here with a
    // recovery token; the hash check covers clients where the event raced us.
    sb.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") setRecovery();
    });
    if (/type=recovery/.test(location.hash || "") || /type=recovery/.test(location.search || "")) setRecovery();
    if (/error_code=otp_expired/.test(location.hash || "") || /error_code=otp_expired/.test(location.search || "")) {
      errEl.textContent = "That reset link expired. Type your email and tap Forgot password to get a fresh one.";
      history.replaceState(null, "", location.pathname);
    }
  }

  document.getElementById("auth-toggle").addEventListener("click", function (e) {
    e.preventDefault();
    setMode(mode === "signup" ? "signin" : "signup");
  });
  document.getElementById("auth-reset").addEventListener("click", async function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    if (!sb) { errEl.textContent = "Accounts are not live yet."; return; }
    if (!email) { errEl.textContent = "Type your email first, then tap Forgot password."; return; }
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    errEl.textContent = r.error ? r.error.message : "Password reset email sent — check your inbox and tap the link inside.";
  });

  document.getElementById("auth-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    errEl.textContent = "";
    if (!sb) { errEl.textContent = "Accounts are not live yet — browse the feed meanwhile."; return; }
    submit.disabled = true; submit.textContent = "Working...";
    try {
      if (mode === "recovery") {
        var np = pwInput.value;
        if (np.length < 6) throw new Error("Password needs at least 6 characters.");
        if (np !== pw2Input.value) throw new Error("The two passwords don't match — type them again.");
        var up = await sb.auth.updateUser({ password: np });
        if (up.error) throw up.error;
        sub.textContent = "Password updated — you're signed in. Taking you to your profile...";
        setTimeout(function () { location.href = "profile.html"; }, 900);
        return;
      }
      var email = emailInput.value.trim();
      var password = pwInput.value;
      if (mode === "signup") {
        var username = document.getElementById("username").value.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Username: 3-24 chars, letters, numbers, underscore only.");
        var taken = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
        if (taken.data) throw new Error("That username is taken — try another.");
        var su = await sb.auth.signUp({ email: email, password: password });
        if (su.error) throw su.error;
        if (su.data.user) {
          var ins = await sb.from("profiles").insert({ id: su.data.user.id, username: username, display_name: username });
          if (ins.error) throw ins.error;
        }
        location.href = "profile.html";
      } else {
        var si = await sb.auth.signInWithPassword({ email: email, password: password });
        if (si.error) throw si.error;
        location.href = "profile.html";
      }
    } catch (ex) {
      errEl.textContent = ex.message || String(ex);
    } finally {
      submit.disabled = false;
      if (mode === "recovery") submit.textContent = "Set new password";
      else submit.textContent = mode === "signup" ? "Create account" : "Sign in";
    }
  });
})();
