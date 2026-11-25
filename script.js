let books = [];
let requests = [];
let currentUser = null;

const db = window.supabaseClient;

// ===============================
// HELPERS
// ===============================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function showMessage(message) {
    const element = document.getElementById("authMessage");
    if (element) element.textContent = message;
}

// ===============================
// PAGE NAVIGATION
// ===============================

function showPage(page) {
    if (page !== "auth" && !currentUser) {
        page = "auth";
        showMessage("Please login to access CampusBookHub.");
    }

    document.querySelectorAll(".page").forEach(section => {
        section.classList.add("hidden");
    });

    const target = document.getElementById(page);

    if (target) {
        target.classList.remove("hidden");
    }

    renderBooks();
    renderRequests();
    renderMyBooks();
    updateStats();
}

// ===============================
// LOAD DATA FROM SUPABASE
// ===============================

async function loadData() {
    if (!currentUser) return;

    const { data: bookData, error: bookError } =
        await db.from("books")
        .select("*")
        .order("created_at", { ascending: false });

    if (bookError) {
        alert("Could not load books: " + bookError.message);
        return;
    }

    const { data: requestData, error: requestError } =
        await db.from("book_requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (requestError) {
        alert("Could not load requests: " + requestError.message);
        return;
    }

    books = bookData || [];
    requests = requestData || [];

    renderBooks();
    renderRequests();
    renderMyBooks();
    updateStats();
}

// ===============================
// BROWSE BOOKS
// ===============================

function renderBooks() {
    const list = document.getElementById("bookList");
    if (!list) return;

    const searchElement = document.getElementById("search");
    const categoryElement = document.getElementById("category");

    const search = searchElement ? searchElement.value.toLowerCase() : "";
    const category = categoryElement ? categoryElement.value : "";

    const filtered = books.filter(book =>
        book.status === "available" &&
        (
            (book.title || "").toLowerCase().includes(search) ||
            (book.author || "").toLowerCase().includes(search)
        ) &&
        (!category || book.category === category)
    );

    list.innerHTML = "";

    if (!currentUser) {
        list.innerHTML = "<p>Please login to browse books.</p>";
        return;
    }

    if (filtered.length === 0) {
        list.innerHTML = "<p>No available books found.</p>";
        return;
    }

    filtered.forEach(book => {
        const isOwner = book.owner_id === currentUser.id;

        list.innerHTML += `
            <div class="book-card">
                <h3>${escapeHTML(book.title)}</h3>
                <p>Author: ${escapeHTML(book.author)}</p>
                <p>Category: ${escapeHTML(book.category)}</p>
                <p>Description: ${escapeHTML(book.description || "No description added.")}</p>
                <p>Condition: ${escapeHTML(book.condition)}</p>
                <p>Owner: ${escapeHTML(book.owner_name)}</p>
                <p>Type: ${escapeHTML(book.book_type)}</p>
                <p class="status">Available</p>

                ${!isOwner ? `
                    <button onclick="sendRequest('${book.id}')">
                        Request Book
                    </button>
                ` : `
                    <p>Your listing</p>
                `}
            </div>
        `;
    });
}
// ===============================
// ADD BOOK
// ===============================

const bookForm = document.getElementById("bookForm");

if (bookForm) {
    bookForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        if (!currentUser) {
            alert("Please login first.");
            showPage("auth");
            return;
        }

        const newBook = {
            owner_id: currentUser.id,
            owner_name: document.getElementById("owner").value.trim(),
            title: document.getElementById("title").value.trim(),
            author: document.getElementById("author").value.trim(),
            category: document.getElementById("newCategory").value,
            condition: document.getElementById("condition").value,
	    description: document.getElementById("description").value.trim(),
            book_type: document.getElementById("method").value.toLowerCase(),
            status: "available"
        };

        const { error } = await db.from("books").insert([newBook]);

        if (error) {
            alert("Could not add book: " + error.message);
            return;
        }

        bookForm.reset();

        alert("Book added successfully!");
        await loadData();
        showPage("browse");
    });
}

// ===============================
// SEND BOOK REQUEST
// ===============================

async function sendRequest(bookId) {
    if (!currentUser) {
        showPage("auth");
        return;
    }

    const book = books.find(b => b.id === bookId);

    if (!book || book.status !== "available") {
        alert("This book is no longer available.");
        return;
    }

    if (book.owner_id === currentUser.id) {
        alert("You cannot request your own book.");
        return;
    }

    const requesterName = prompt("Enter your name:");

    if (!requesterName || !requesterName.trim()) return;

    const alreadyRequested = requests.some(r =>
        r.book_id === bookId &&
        r.requester_id === currentUser.id &&
        r.status === "pending"
    );

    if (alreadyRequested) {
        alert("You already have a pending request for this book.");
        return;
    }

    const newRequest = {
        book_id: bookId,
        requester_id: currentUser.id,
        requester_name: requesterName.trim(),
        requester_email: currentUser.email,
        request_type: book.book_type,
        status: "pending"
    };

    const { error } = await db.from("book_requests").insert([newRequest]);

    if (error) {
        alert("Could not send request: " + error.message);
        return;
    }

    alert("Book request sent successfully!");
    await loadData();
}

// ===============================
// DISPLAY REQUESTS
// ===============================

function renderRequests() {
    const list = document.getElementById("requestList");
    if (!list) return;

    list.innerHTML = "";

    if (!currentUser) {
        list.innerHTML = "<p>Please login to view requests.</p>";
        return;
    }

    const myRequests = requests.filter(request => {
        const book = books.find(b => b.id === request.book_id);

        return request.requester_id === currentUser.id ||
               (book && book.owner_id === currentUser.id);
    });

    if (myRequests.length === 0) {
        list.innerHTML = "<p>No book requests yet.</p>";
        return;
    }

    myRequests.forEach(request => {
        const book = books.find(b => b.id === request.book_id);
        if (!book) return;

        const isOwner = book.owner_id === currentUser.id;
        const status = request.status;

        list.innerHTML += `
            <div class="request-card">
                <h3>${escapeHTML(book.title)}</h3>
                <p>Requested by: ${escapeHTML(request.requester_name)}</p>
                <p>Book Owner: ${escapeHTML(book.owner_name)}</p>
                <p>Type: ${escapeHTML(request.request_type)}</p>
                <p>Status: <strong>${escapeHTML(status)}</strong></p>

                ${isOwner && status === "pending" ? `
                    <button onclick="updateRequest('${request.id}', 'approved')">
                        Accept
                    </button>

                    <button onclick="updateRequest('${request.id}', 'rejected')">
                        Reject
                    </button>
                ` : ""}
            </div>
        `;
    });
}

// ===============================
// ACCEPT / REJECT REQUEST
// ===============================

async function updateRequest(requestId, decision) {
    if (!currentUser) return;

    const request = requests.find(r => r.id === requestId);

    if (!request || request.status !== "pending") return;

    const book = books.find(b => b.id === request.book_id);

    if (!book || book.owner_id !== currentUser.id) {
        alert("Only the book owner can respond to this request.");
        return;
    }

    if (decision === "approved") {
        if (book.status !== "available") {
            alert("This book is no longer available.");
            return;
        }

        const { error: bookError } = await db.from("books")
            .update({ status: "borrowed" })
            .eq("id", book.id);

        if (bookError) {
            alert("Could not update book: " + bookError.message);
            return;
        }

        // Reject other pending requests for the same book
        const otherRequests = requests.filter(r =>
            r.book_id === book.id &&
            r.id !== request.id &&
            r.status === "pending"
        );

        for (const other of otherRequests) {
            const { error } = await db.from("book_requests")
                .update({ status: "rejected" })
                .eq("id", other.id);

            if (error) {
                alert("Could not update another request: " + error.message);
            }
        }
    }

    const { error: requestError } = await db.from("book_requests")
        .update({ status: decision })
        .eq("id", request.id);

    if (requestError) {
        alert("Could not update request: " + requestError.message);
        return;
    }

    alert(decision === "approved" ? "Request accepted!" : "Request rejected.");

    await loadData();
}

// ===============================
// MY BOOKS
// ===============================

function renderMyBooks() {
    const list = document.getElementById("myBookList");
    if (!list) return;

    list.innerHTML = "";

    if (!currentUser) {
        list.innerHTML = "<p>Please login to view your books.</p>";
        return;
    }

    const myBooks = books.filter(book => book.owner_id === currentUser.id);

    if (myBooks.length === 0) {
        list.innerHTML = "<p>You haven't listed any books yet.</p>";
        return;
    }

    myBooks.forEach(book => {
        list.innerHTML += `
            <div class="book-card">
                <h3>${escapeHTML(book.title)}</h3>
                <p>Author: ${escapeHTML(book.author)}</p>
                <p>Category: ${escapeHTML(book.category)}</p>
                <p>Description: ${escapeHTML(book.description || "No description added.")}</p>
                <p>Condition: ${escapeHTML(book.condition)}</p>
                <p>Type: ${escapeHTML(book.book_type)}</p>
                <p>Status: <strong>${escapeHTML(book.status)}</strong></p>

                ${book.status === "borrowed" ? `
                    <button onclick="returnBook('${book.id}')">
                        Mark Returned
                    </button>
                ` : ""}

               <button onclick="editBook('${book.id}')">
    Edit
</button>

<button onclick="deleteBook('${book.id}')">
    Delete Listing
</button>
            </div>
        `;
    });
}
// ===============================
// RETURN BOOK
// ===============================

async function returnBook(bookId) {
    if (!currentUser) return;

    const book = books.find(b => b.id === bookId);

    if (!book || book.owner_id !== currentUser.id ||
        book.status !== "borrowed") {
        alert("This book cannot be returned from here.");
        return;
    }

    const { error: bookError } = await db.from("books")
        .update({ status: "available" })
        .eq("id", bookId);

    if (bookError) {
        alert("Could not return book: " + bookError.message);
        return;
    }

    const approvedRequests = requests.filter(r =>
        r.book_id === bookId && r.status === "approved"
    );

    for (const request of approvedRequests) {
        const { error } = await db.from("book_requests")
            .update({ status: "returned" })
            .eq("id", request.id);

        if (error) {
            alert("Book returned, but request status could not be updated.");
        }
    }

    alert("Book marked as returned!");
    await loadData();
}

// ===============================
// DELETE BOOK
// ===============================

async function deleteBook(bookId) {
    if (!currentUser) return;

    if (!confirm("Are you sure you want to delete this book?")) return;

    const book = books.find(b => b.id === bookId);

    if (!book || book.owner_id !== currentUser.id) {
        alert("You can only delete your own listings.");
        return;
    }

    const { error } = await db.from("books")
        .delete()
        .eq("id", bookId);

    if (error) {
        alert("Could not delete book: " + error.message);
        return;
    }

    alert("Book listing deleted.");
    await loadData();
}

// ===============================
// STATISTICS
// ===============================

function updateStats() {
    const total = document.getElementById("totalBooks");
    const available = document.getElementById("availableBooks");
    const totalRequests = document.getElementById("totalRequests");

    if (total) total.textContent = books.length;

    if (available) {
        available.textContent =
            books.filter(b => b.status === "available").length;
    }

    if (totalRequests) totalRequests.textContent = requests.length;
}

// ===============================
// AUTHENTICATION
// ===============================

const authForm = document.getElementById("authForm");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

if (authForm) {
    authForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        showMessage("Logging in...");

        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        currentUser = data.user;

        if (userInfo) {
            userInfo.textContent = "Logged in as: " + currentUser.email;
        }

        if (logoutBtn) logoutBtn.classList.remove("hidden");

        await loadData();
        showMessage("Login successful!");
        showPage("browse");
    });
}

// SIGN UP
if (signupBtn) {
    signupBtn.addEventListener("click", async function() {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showMessage("Enter email and password first.");
            return;
        }

        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.");
            return;
        }

        showMessage("Creating account...");

        const { data, error } = await db.auth.signUp({
            email,
            password
        });

        if (error) {
            showMessage(error.message);
            return;
        }

        if (data.session) {
            currentUser = data.user;

            if (userInfo) {
                userInfo.textContent = "Logged in as: " + currentUser.email;
            }

            if (logoutBtn) logoutBtn.classList.remove("hidden");

            await loadData();
            showPage("browse");
            showMessage("Account created successfully!");
        } else {
            showMessage("Account created! Now login using your email and password.");
        }
    });
}

// LOGOUT
if (logoutBtn) {
    logoutBtn.addEventListener("click", async function() {
        const { error } = await db.auth.signOut();

        if (error) {
            showMessage(error.message);
            return;
        }

        currentUser = null;
        books = [];
        requests = [];

        if (userInfo) userInfo.textContent = "";

        logoutBtn.classList.add("hidden");

        showMessage("Logged out successfully.");
        showPage("auth");
    });
}

// ===============================
// CHECK EXISTING SESSION
// ===============================

async function initializeApp() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        showMessage(error.message);
        showPage("auth");
        return;
    }

    currentUser = data.session ? data.session.user : null;

    if (currentUser) {
        if (userInfo) {
            userInfo.textContent = "Logged in as: " + currentUser.email;
        }

        if (logoutBtn) logoutBtn.classList.remove("hidden");

        await loadData();
        showPage("browse");
    } else {
        if (logoutBtn) logoutBtn.classList.add("hidden");
        showPage("auth");
    }
}

initializeApp();
async function logoutUser() {
    const { error } = await window.supabaseClient.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
        return;
    }

    currentUser = null;
    showPage("auth");
    alert("Logged out successfully!");
}
function editBook(bookId) {
    const book = books.find(b => b.id === bookId);

    if (!book || book.owner_id !== currentUser.id) {
        alert("You can only edit your own books.");
        return;
    }

    document.getElementById("editBookId").value = book.id;
    document.getElementById("editTitle").value = book.title || "";
    document.getElementById("editAuthor").value = book.author || "";
    document.getElementById("editDescription").value = book.description || "";
    document.getElementById("editCategory").value = book.category || "Other";
    document.getElementById("editCondition").value = book.condition || "Good";
    document.getElementById("editMethod").value = book.book_type || "Exchange";

    document.getElementById("editBookSection").classList.remove("hidden");

    document.getElementById("editBookSection").scrollIntoView({
        behavior: "smooth"
    });
}

function cancelEdit() {
    document.getElementById("editBookSection").classList.add("hidden");
    document.getElementById("editBookForm").reset();
}

document.getElementById("editBookForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const bookId = document.getElementById("editBookId").value;

    const { error } = await db
        .from("books")
        .update({
            title: document.getElementById("editTitle").value.trim(),
            author: document.getElementById("editAuthor").value.trim(),
            description: document.getElementById("editDescription").value.trim(),
            category: document.getElementById("editCategory").value,
            condition: document.getElementById("editCondition").value,
            book_type: document.getElementById("editMethod").value
        })
        .eq("id", bookId)
        .eq("owner_id", currentUser.id);

    if (error) {
        alert("Error updating book: " + error.message);
        return;
    }

    alert("Book updated successfully!");

    document.getElementById("editBookSection").classList.add("hidden");
    document.getElementById("editBookForm").reset();

    await loadData();
    showPage("mine");
});
