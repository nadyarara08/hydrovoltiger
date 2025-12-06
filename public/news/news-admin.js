import { db, auth } from "../auth/firebase-init.js";
import { ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ============== AUTH CHECK ==============
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  document.getElementById("userNameNav").textContent = name;
  document.getElementById("userAvatarNav").textContent = name.charAt(0).toUpperCase();
  
  // Set default author to current user
  document.getElementById("newsAuthor").value = name;
});

// ============== DROPDOWN TOGGLE ==============
document.getElementById("userInfoButton").addEventListener("click", () => {
  const dropdown = document.getElementById("ProfileDropdownNav");
  dropdown.classList.toggle("show");
});

document.addEventListener("click", (e) => {
  const userInfo = document.getElementById("userInfoButton");
  const dropdown = document.getElementById("ProfileDropdownNav");
  
  if (!userInfo.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// ============== LOGOUT ==============
document.getElementById("logoutButton").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "../login/login.html";
  });
});

// ============== SET TODAY'S DATE AS DEFAULT ==============
const today = new Date().toISOString().split('T')[0];
document.getElementById("newsDate").value = today;

// ============== ADD NEWS FORM SUBMISSION ==============
document.getElementById("addNewsForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newsData = {
    title: document.getElementById("newsTitle").value.trim(),
    category: document.getElementById("newsCategory").value,
    date: document.getElementById("newsDate").value,
    author: document.getElementById("newsAuthor").value.trim() || "Admin Hydrovoltiger",
    image: document.getElementById("newsImage").value.trim(),
    content: document.getElementById("newsContent").value.trim(),
    createdAt: new Date().toISOString()
  };

  try {
    // Push to Firebase
    const newsRef = ref(db, "News");
    await push(newsRef, newsData);

    // Show success modal
    showSuccessModal();

    // Reset form
    document.getElementById("addNewsForm").reset();
    document.getElementById("newsDate").value = today;
    document.getElementById("newsAuthor").value = auth.currentUser.displayName || auth.currentUser.email.split("@")[0];

    console.log("✅ News added successfully!");
  } catch (error) {
    console.error("❌ Error adding news:", error);
    alert("Gagal menambahkan berita. Silakan coba lagi.");
  }
});

// ============== LOAD NEWS LIST ==============
const newsListEl = document.getElementById("newsList");
const newsRefList = ref(db, "News");

onValue(newsRefList, snapshot => {
  newsListEl.innerHTML = "";

  if (!snapshot.exists()) {
    newsListEl.innerHTML = `
      <div class="empty-state">
        <ion-icon name="document-outline"></ion-icon>
        <p>Belum ada berita yang dipublikasikan.</p>
      </div>
    `;
    return;
  }

  const newsData = snapshot.val();
  
  // Convert to array and sort by date (newest first)
  const newsArray = Object.keys(newsData).map(id => ({
    id,
    ...newsData[id]
  }));

  newsArray.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date);
    }
    return 0;
  });

  newsArray.forEach(news => {
    // Format date
    let formattedDate = news.date || 'Tanggal tidak tersedia';
    if (news.date) {
      try {
        const dateObj = new Date(news.date);
        formattedDate = dateObj.toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        formattedDate = news.date;
      }
    }

    // Content preview
    const contentPreview = news.content && news.content.length > 200 
      ? news.content.substring(0, 200) + '...' 
      : news.content || 'Tidak ada konten.';

    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';
    newsItem.innerHTML = `
      <div class="news-item-image">
        <img src="${news.image || 'https://via.placeholder.com/120x120/123440/ffffff?text=No+Image'}" 
             alt="${news.title || 'News'}"
             onerror="this.src='https://via.placeholder.com/120x120/123440/ffffff?text=Error'">
      </div>

      <div class="news-item-content">
        <div class="news-item-header">
          <h3 class="news-item-title">${news.title || 'Untitled'}</h3>
          <div class="news-item-actions">
            <button class="btn-icon btn-edit" onclick="window.open('news-detail.html?id=${news.id}', '_blank')" title="Lihat Detail">
              <ion-icon name="eye-outline"></ion-icon>
            </button>
            <button class="btn-icon btn-delete" onclick="deleteNews('${news.id}', '${(news.title || '').replace(/'/g, "\\'")}')">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </div>
        </div>

        <div class="news-item-meta">
          <span>
            <ion-icon name="pricetag-outline"></ion-icon>
            ${news.category || 'Umum'}
          </span>
          <span>
            <ion-icon name="calendar-outline"></ion-icon>
            ${formattedDate}
          </span>
          <span>
            <ion-icon name="person-outline"></ion-icon>
            ${news.author || 'Admin'}
          </span>
        </div>

        <p class="news-item-preview">${contentPreview}</p>
      </div>
    `;

    newsListEl.appendChild(newsItem);
  });
}, error => {
  console.error("❌ Error loading news:", error);
  newsListEl.innerHTML = `
    <div class="empty-state">
      <ion-icon name="alert-circle-outline"></ion-icon>
      <p style="color: #e53e3e;">Error loading news. Please check console.</p>
    </div>
  `;
});

// ============== MODAL FUNCTIONS ==============
function showSuccessModal() {
  const modal = document.getElementById('successModal');
  modal.classList.add('show');
}

window.closeModal = function() {
  const modal = document.getElementById('successModal');
  modal.classList.remove('show');
};

// Click outside to close
document.getElementById('successModal').addEventListener('click', (e) => {
  if (e.target.id === 'successModal') {
    closeModal();
  }
});

// ============== DELETE NEWS ==============
let newsToDelete = null;

window.deleteNews = function(newsId, newsTitle) {
  newsToDelete = newsId;
  const modal = document.getElementById('deleteModal');
  modal.querySelector('p').textContent = `Apakah Anda yakin ingin menghapus "${newsTitle}"? Tindakan ini tidak dapat dibatalkan.`;
  modal.classList.add('show');
};

window.confirmDelete = async function() {
  if (!newsToDelete) return;

  try {
    const newsRef = ref(db, `News/${newsToDelete}`);
    await remove(newsRef);
    
    console.log(`✅ News ${newsToDelete} deleted successfully`);
    closeDeleteModal();
    newsToDelete = null;
    
    // Show brief success message
    alert('Berita berhasil dihapus!');
  } catch (error) {
    console.error("❌ Error deleting news:", error);
    alert("Gagal menghapus berita. Silakan coba lagi.");
  }
};

window.closeDeleteModal = function() {
  const modal = document.getElementById('deleteModal');
  modal.classList.remove('show');
  newsToDelete = null;
};

// Click outside to close delete modal
document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target.id === 'deleteModal') {
    closeDeleteModal();
  }
});