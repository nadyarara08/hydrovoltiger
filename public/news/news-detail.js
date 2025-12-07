import { db, auth } from "../auth/firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
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
});

// ============== DROPDOWN TOGGLE ==============
document.getElementById("userInfoButton").addEventListener("click", () => {
  const dropdown = document.getElementById("profileDropdownNav");
  dropdown.classList.toggle("show");
});

document.addEventListener("click", (e) => {
  const userInfo = document.getElementById("userInfoButton");
  const dropdown = document.getElementById("profileDropdownNav");
  
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

// ============== GET NEWS ID FROM URL ==============
const urlParams = new URLSearchParams(window.location.search);
const newsId = urlParams.get('id');

if (!newsId) {
  showError();
} else {
  loadNewsDetail(newsId);
}

// ============== LOAD NEWS DETAIL ==============
function loadNewsDetail(id) {
  const newsRef = ref(db, `News/${id}`);
  
  onValue(newsRef, snapshot => {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const newsDetail = document.getElementById('newsDetail');
    
    if (!snapshot.exists()) {
      loadingState.style.display = 'none';
      errorState.style.display = 'block';
      return;
    }

    const news = snapshot.val();
    
    // Format date
    let formattedDate = 'Tanggal tidak tersedia';
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

    // Update page title
    document.title = `${news.title || 'Detail Berita'} - Hydrovoltiger`;

    // Populate content
    document.getElementById('newsCategoryBadge').textContent = news.category || 'Umum';
    document.getElementById('newsTitle').textContent = news.title || 'Judul Tidak Tersedia';
    document.getElementById('newsDate').textContent = formattedDate;
    document.getElementById('newsAuthor').textContent = news.author || 'Admin Hydrovoltiger';
    
    const newsImage = document.getElementById('newsImage');
    newsImage.src = news.image || 'https://via.placeholder.com/1200x600/123440/ffffff?text=Hydrovoltiger+News';
    newsImage.alt = news.title || 'News Image';
    newsImage.onerror = function() {
      this.src = 'https://via.placeholder.com/1200x600/123440/ffffff?text=Image+Not+Found';
    };

    // Format content with paragraphs
    const contentDiv = document.getElementById('newsContent');
    if (news.content) {
      // Split by newlines and create paragraphs
      const paragraphs = news.content.split('\n').filter(p => p.trim() !== '');
      contentDiv.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    } else {
      contentDiv.innerHTML = '<p>Konten tidak tersedia.</p>';
    }

    // Show detail, hide loading
    loadingState.style.display = 'none';
    newsDetail.style.display = 'block';

  }, error => {
    console.error("Error loading news detail:", error);
    showError();
  });
}

// ============== SHOW ERROR ==============
function showError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
}

// ============== SHARE FUNCTIONS ==============
window.shareToWhatsApp = function() {
  const title = document.getElementById('newsTitle').textContent;
  const url = window.location.href;
  const text = `${title}\n\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.shareToFacebook = function() {
  const url = window.location.href;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
};

window.shareToTwitter = function() {
  const title = document.getElementById('newsTitle').textContent;
  const url = window.location.href;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
};

window.copyLink = function() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link berhasil disalin!');
  }).catch(err => {
    console.error('Error copying link:', err);
    alert('Gagal menyalin link.');
  });
};

// ============== TAMBAHKAN DI news.js, news-detail.js ==============
// Letakkan setelah onAuthStateChanged

// List email admin (sesuaikan dengan email admin Anda)
const ADMIN_EMAILS = [
  'wishnuhydrovoltiger@gmail.com',
  'rarakirani08@gmail.com',
  // Tambahkan email admin lainnya di sini
];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const name = user.displayName || user.email.split("@")[0];
  document.getElementById("userNameNav").textContent = name;
  document.getElementById("userAvatarNav").textContent = name.charAt(0).toUpperCase();
  
  // Check if user is admin and show admin menu
  if (ADMIN_EMAILS.includes(user.email)) {
    showAdminMenu();
  }
});

// Function to show admin menu
function showAdminMenu() {
  const navMenu = document.querySelector('.nav-menu');
  
  // Check if admin link already exists
  if (!document.getElementById('adminMenuLink')) {
    // Find the News nav item
    const newsNavItem = Array.from(navMenu.querySelectorAll('.nav-item'))
      .find(item => item.textContent.includes('News'));
    
    // Create admin nav item
    const adminNavItem = document.createElement('a');
    adminNavItem.href = 'news-admin.html';
    adminNavItem.className = 'nav-item';
    adminNavItem.id = 'adminMenuLink';
    adminNavItem.innerHTML = `
      <ion-icon name="shield-checkmark-outline"></ion-icon>
      <span>Admin News</span>
    `;
    
    // Insert after News nav item
    if (newsNavItem && newsNavItem.nextSibling) {
      navMenu.insertBefore(adminNavItem, newsNavItem.nextSibling);
    }
  }
}