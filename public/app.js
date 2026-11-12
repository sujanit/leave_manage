const $ = (id) => document.getElementById(id);
let currentUserId = localStorage.getItem("leaveUserId");

function show(view) {
  ["registerView", "loginView", "dashboardView"].forEach(id => $(id).classList.add("hidden"));
  $(view).classList.remove("hidden");
  setMessage("");
}
function setMessage(message, type = "") {
  $("message").textContent = message;
  $("message").className = type;
}
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
function saveUser(user) {
  currentUserId = user._id;
  localStorage.setItem("leaveUserId", user._id);
  renderUser(user);
}
function renderUser(user) {
  $("welcome").textContent = `Welcome, ${user.username} (Roll Number: ${user.rollNumber})`;
  $("casualBalance").textContent = user.casualLeave;
  $("medicalBalance").textContent = user.medicalLeave;
  show("dashboardView");
  loadHistory();
}
async function loadBalance() {
  if (!currentUserId) return show("loginView");
  try {
    const data = await request(`/api/users/${currentUserId}`);
    renderUser(data.user);
    setMessage("Balance refreshed.", "success");
  } catch (error) {
    localStorage.removeItem("leaveUserId");
    currentUserId = null;
    show("loginView");
    setMessage(error.message, "error");
  }
}
async function loadHistory() {
  if (!currentUserId) return;
  try {
    const data = await request(`/api/leaves/${currentUserId}`);
    const container = $("leaveHistory");
    if (!data.leaves.length) {
      container.innerHTML = "<p>No applications yet.</p>";
      return;
    }
    container.replaceChildren();
    data.leaves.forEach(leave => {
      const item = document.createElement("div");
      item.className = "history-item";
      const summary = document.createElement("p");
      summary.textContent = `${leave.leaveType} Leave — ${leave.days} day(s)`;
      const status = document.createElement("p");
      status.textContent = `Status: ${leave.status}`;
      const date = document.createElement("p");
      date.textContent = `Applied: ${new Date(leave.appliedAt).toLocaleString()}`;
      item.append(summary, status, date);
      container.appendChild(item);
    });
  } catch {
    $("leaveHistory").textContent = "Could not load leave history.";
  }
}

$("showLogin").addEventListener("click", e => { e.preventDefault(); show("loginView"); });
$("showRegister").addEventListener("click", e => { e.preventDefault(); show("registerView"); });

$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    username: $("username").value.trim(),
    email: $("email").value.trim(),
    rollNumber: $("rollNumber").value.trim(),
    casualLeave: Number($("casualLeave").value),
    medicalLeave: Number($("medicalLeave").value)
  };
  try {
    const data = await request("/api/users/register", {
      method: "POST", body: JSON.stringify(payload)
    });
    $("registerForm").reset();
    show("loginView");
    $("loginEmail").value = payload.email;
    $("loginRoll").value = payload.rollNumber;
    setMessage(data.message, "success");
  } catch (error) { setMessage(error.message, "error"); }
});

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = await request("/api/users/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("loginEmail").value.trim(),
        rollNumber: $("loginRoll").value.trim()
      })
    });
    saveUser(data.user);
    setMessage(data.message, "success");
  } catch (error) { setMessage(error.message, "error"); }
});

$("leaveForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = await request("/api/leaves", {
      method: "POST",
      body: JSON.stringify({
        userId: currentUserId,
        leaveType: $("leaveType").value,
        days: Number($("days").value)
      })
    });
    renderUser(data.user);
    $("days").value = 1;
    setMessage(data.message, "success");
  } catch (error) { setMessage(error.message, "error"); }
});

$("refreshButton").addEventListener("click", loadBalance);
$("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("leaveUserId");
  currentUserId = null;
  $("loginForm").reset();
  show("loginView");
  setMessage("You have logged out.", "success");
});

if (currentUserId) loadBalance();
else show("registerView");
