function validate() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorMsg = document.getElementById("errorMsg");

    errorMsg.style.display = "none";

    fetch("../data/admin_login.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("CSV file not found");
            }
            return response.text();
        })
        .then(data => {
            const rows = data.split("\n").slice(1);
            let loginSuccess = false;

            rows.forEach(row => {
                if (!row.trim()) return;

                const columns = row.split(",");
                const csvUsername = columns[0].trim();
                const csvPassword = columns[1].trim();

                if (username === csvUsername && password === csvPassword) {
                    loginSuccess = true;
                }
            });

            if (loginSuccess) {
                window.location.href = "admin_dashboard.html";
            } else {
                errorMsg.style.display = "block";
            }
        })
        .catch(error => {
            errorMsg.innerText = "Error loading admin data file";
            errorMsg.style.display = "block";
            console.error(error);
        });
}
