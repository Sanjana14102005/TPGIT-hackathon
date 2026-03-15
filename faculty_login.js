document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();   // Prevent page reload
    validate();
});

function validate() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (username === "" || password === "") {
        alert("Please enter both username and password");
        return;
    }

    fetch("data/faculty_login.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("CSV file not found");
            }
            return response.text();
        })
        .then(data => {
            const rows = data.trim().split("\n").slice(1);
            let isValid = false;

            rows.forEach(row => {
                const cols = row.split(",");
                if (
                    cols[0].trim() === username &&
                    cols[1].trim() === password
                ) {
                    isValid = true;
                }
            });

            if (isValid) {
                alert("Faculty login successful");
                window.location.href = "faculty_dashboard.html";
            } else {
                alert("Invalid faculty username or password");
            }
        })
        .catch(error => {
            alert("Error loading faculty login data. Are you using Live Server?");
            console.error(error);
        });
}
