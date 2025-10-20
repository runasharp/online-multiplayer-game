async function register() {
  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: document.getElementById("regUser").value,
      password: document.getElementById("regPass").value,
    }),
  });
  const data = await res.json();
  document.getElementById("msg").innerText =
    data.error || "Registered! You can now login.";
}

async function login() {
  const username = document.getElementById("loginUser").value;
  const password = document.getElementById("loginPass").value;

  if (!username || !password) {
    document.getElementById("msg").textContent = "Enter username and password";
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.success) {
      // ✅ Step 1: redirect to game page with username in URL
      const token = data.token;
      window.location.href = `/index.html?token=${encodeURIComponent(token)}`;
    } else {
      document.getElementById("msg").textContent = data.error;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("msg").textContent = "Server error";
  }
}
