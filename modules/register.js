async function register(event) {
  event.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const studentClass = document.getElementById("class").value;

  const response = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      class: studentClass
    })
  });

  const data = await response.json();

  if (response.ok) {
    alert("Registration successful!");
    window.location.href = "login.html";
  } else {
    alert(data.message || "Registration failed");
  }
}