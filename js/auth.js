// VIRALX auth — Supabase Auth (email/password) + profile creation on sign-up.
(function () {
  var sb = window.VX && window.VX.sb;
  var mode = "signin";
  var errEl = document.getElementById("auth-error");
  var submit = document.getElementById("auth-submit");
  var sub = document.getElementById("auth-sub");
  var userField = document.getElementById("username-field");

  if (!sb) document.getElementById("demo-note").classList.remove("hidden");

  function setMode(m) {
    mode = m;
    userField.classList.toggle("hidden", m !== "signup");
    submit.textContent = m === "signup" ? "Create account" : "Sign in";
    sub.textContent = m === "signup" ? "Create your account — free forever." : "Sign in to post, go live, and get paid.";
    document.getElementById("auth-toggle").textContent = m === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
    errEl.textContent = "";
  }
  document.getElementById("auth-toggle").addEventListener("click", function (e) {
    e.preventDefault();
    setMode(mode === "signup" ? "signin" : "signup");
  });
  document.getElementById("auth-reset").addEventListener("click", async function (e) {
    e.preventDefault();
    var email = document.getElementById("email").value.trim();
    if (!sb) { errEl.textContent = "Accounts are not live yet."; return; }
    if (!email) { errEl.textContent = "Type your email first, then tap Forgot password."; return; }
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    errEl.textContent = r.error ? r.error.message : "Password reset email sent — check your inbox.";
  });

  document.getElementById("auth-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    errEl.textContent = "";
    if (!sb) { errEl.textContent = "Accounts are not live yet — browse the feed meanwhile."; return; }
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    submit.disabled = true; submit.textContent = "Working...";
    try {
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
      submit.textContent = mode === "signup" ? "Create account" : "Sign in";
    }
  });
})();
