// Load saved information
let books = JSON.parse(localStorage.getItem("books")) || [
    {
        id: 1,
        title: "Java Programming",
        author: "Herbert Schildt",
        category: "Programming",
        condition: "Good",
        method: "Borrow",
        owner: "Rahul",
        status: "Available",
        reuse: 0
    },
    {
        id: 2,
        title: "The Alchemist",
        author: "Paulo Coelho",
        category: "Fiction",
        condition: "New",
        method: "Exchange",
        owner: "Ananya",
        status: "Available",
        reuse: 0
    },
    {
        id: 3,
        title: "Engineering Mathematics",
        author: "B.S. Grewal",
        category: "Engineering",
        condition: "Used",
        method: "Donate",
        owner: "Priya",
        status: "Available",
        reuse: 0
    }
];

let requests = JSON.parse(localStorage.getItem("requests")) || [];

function saveData() {
    localStorage.setItem("books", JSON.stringify(books));
    localStorage.setItem("requests", JSON.stringify(requests));
}

function showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.add("hidden");
    });

    document.getElementById(page).classList.remove("hidden");

    renderBooks();
    renderRequests();
    renderMyBooks();
    updateStats();
}

// Display books
function renderBooks() {
    const list = document.getElementById("bookList");
    if (!list) return;

    const search = document.getElementById("search").value.toLowerCase();
    const category = document.getElementById("category").value;

    const filtered = books.filter(book =>
        book.status === "Available" &&
        (book.title.toLowerCase().includes(search) ||
         book.author.toLowerCase().includes(search)) &&
        (!category || book.category === category)
    );

    list.innerHTML = "";

    if (filtered.length === 0) {
        list.innerHTML = "<p>No available books found.</p>";
        return;
    }

    filtered.forEach(book => {
        list.innerHTML += `
            <div class="book-card">
                <h3>${book.title}</h3>
                <p>Author: ${book.author}</p>
                <p>Category: ${book.category}</p>
                <p>Condition: ${book.condition}</p>
                <p>Owner: ${book.owner}</p>
                <p>Type: ${book.method}</p>
                <p class="status">${book.status}</p>
                <button onclick="sendRequest(${book.id})">
                    Request Book
                </button>
            </div>
        `;
    });
}

// Add a new book
document.getElementById("bookForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const newBook = {
        id: Date.now(),
        title: document.getElementById("title").value.trim(),
        author: document.getElementById("author").value.trim(),
        category: document.getElementById("newCategory").value,
        condition: document.getElementById("condition").value,
        method: document.getElementById("method").value,
        owner: document.getElementById("owner").value.trim(),
        status: "Available",
        reuse: 0
    };

    books.push(newBook);
    saveData();

    this.reset();

    alert("Your book has been added!");
    showPage("browse");
});

// Send a book request
function sendRequest(bookId) {
    const book = books.find(b => b.id === bookId);

    if (!book || book.status !== "Available") {
        alert("This book is not available.");
        return;
    }

    const requester = prompt("Enter your name:");

    if (!requester || !requester.trim()) return;

    if (requester.trim().toLowerCase() === book.owner.toLowerCase()) {
        alert("You cannot request your own book.");
        return;
    }

    const alreadyRequested = requests.some(r =>
        r.bookId === bookId &&
        r.requester.toLowerCase() === requester.trim().toLowerCase() &&
        r.status === "Pending"
    );

    if (alreadyRequested) {
        alert("You already requested this book.");
        return;
    }

    requests.push({
        id: Date.now(),
        bookId: bookId,
        requester: requester.trim(),
        owner: book.owner,
        status: "Pending",
        date: new Date().toLocaleDateString()
    });

    saveData();
    updateStats();

    alert("Book request sent successfully!");
}

// Display requests
function renderRequests() {
    const list = document.getElementById("requestList");
    if (!list) return;

    list.innerHTML = "";

    if (requests.length === 0) {
        list.innerHTML = "<p>No book requests yet.</p>";
        return;
    }

    requests.forEach(request => {
        const book = books.find(b => b.id === request.bookId);
        if (!book) return;

        list.innerHTML += `
            <div class="request-card">
                <h3>${book.title}</h3>
                <p>Requested by: ${request.requester}</p>
                <p>Book Owner: ${request.owner}</p>
                <p>Date: ${request.date}</p>
                <p>Status: <strong>${request.status}</strong></p>

                ${request.status === "Pending" ? `
                    <button onclick="updateRequest(${request.id}, 'Accepted')">
                        Accept
                    </button>
                    <button onclick="updateRequest(${request.id}, 'Rejected')">
                        Reject
                    </button>
                ` : ""}
            </div>
        `;
    });
}

// Accept or reject requests
function updateRequest(requestId, decision) {
    const request = requests.find(r => r.id === requestId);

    if (!request || request.status !== "Pending") return;

    const book = books.find(b => b.id === request.bookId);

    if (decision === "Accepted") {
        if (!book || book.status !== "Available") {
            alert("This book is no longer available.");
            return;
        }

        book.status = "Borrowed";
        book.borrower = request.requester;
        book.reuse = (book.reuse || 0) + 1;

        // Reject other pending requests for this book
        requests.forEach(r => {
            if (r.bookId === book.id && r.status === "Pending") {
                r.status = "Rejected";
            }
        });

        request.status = "Accepted";
    } else {
        request.status = "Rejected";
    }

    saveData();
    renderRequests();
    renderBooks();
    renderMyBooks();
    updateStats();
}

// Display books listed by a particular owner
function renderMyBooks() {
    const list = document.getElementById("myBookList");
    if (!list) return;

    list.innerHTML = "";

    if (books.length === 0) {
        list.innerHTML = "<p>No books have been listed.</p>";
        return;
    }

    books.forEach(book => {
        list.innerHTML += `
            <div class="book-card">
                <h3>${book.title}</h3>
                <p>Author: ${book.author}</p>
                <p>Owner: ${book.owner}</p>
                <p>Status: <strong>${book.status}</strong></p>
                <p>Times reused: ${book.reuse || 0}</p>
                ${book.status === "Borrowed" ? `
                    <button onclick="returnBook(${book.id})">
                        Mark Returned
                    </button>
                ` : ""}
                <button onclick="deleteBook(${book.id})">
                    Delete Listing
                </button>
            </div>
        `;
    });
}

// Mark a borrowed book as returned
function returnBook(bookId) {
    const book = books.find(b => b.id === bookId);

    if (!book || book.status !== "Borrowed") return;

    book.status = "Available";
    delete book.borrower;

    requests.forEach(r => {
        if (r.bookId === bookId && r.status === "Accepted") {
            r.status = "Returned";
        }
    });

    saveData();
    showPage("mine");
}

// Delete a listing
function deleteBook(bookId) {
    if (!confirm("Are you sure you want to delete this book?")) return;

    books = books.filter(b => b.id !== bookId);
    requests = requests.filter(r => r.bookId !== bookId);

    saveData();
    showPage("mine");
}

// Dashboard statistics
function updateStats() {
    document.getElementById("totalBooks").textContent = books.length;

    document.getElementById("availableBooks").textContent =
        books.filter(b => b.status === "Available").length;

    document.getElementById("totalRequests").textContent =
        requests.length;
}

// Start website
saveData();
showPage("browse");