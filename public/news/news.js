import { db, auth } from "../auth/firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ============== AUTO NAV ACTIVE ==============
const path = window.location.pathname.toLowerCase();
document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
  if (path.includes(item.getAttribute("href").replace("../", "").toLowerCase())) {
    item.classList.add("active");
  }
});

// ============== USER INFO ==============
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

// Close dropdown when clicking outside
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

// ============== LOAD NEWS FROM FIREBASE ==============
const newsListEl = document.getElementById("newsList");
const newsRef = ref(db, "News");

// Show loading state
newsListEl.innerHTML = `
  <div style="grid-column: 1/-1; text-align:center; padding:40px 20px;">
    <p style="color:#5a7882; font-size:1.1rem;">Loading news...</p>
  </div>
`;

onValue(newsRef, snapshot => {
  newsListEl.innerHTML = "";

  if (!snapshot.exists()) {
    newsListEl.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:40px 20px;">
        <p style="color:#5a7882; font-size:1.1rem;">Tidak ada berita tersedia saat ini.</p>
      </div>
    `;
    return;
  }

  const newsData = snapshot.val();
  let newsCount = 0;

  // Convert to array and sort by date (newest first)
  const newsArray = Object.keys(newsData).map(id => ({
    id,
    ...newsData[id]
  }));

  // Sort by date if available
  newsArray.sort((a, b) => {
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date);
    }
    return 0;
  });

  newsArray.forEach(n => {
    newsCount++;
    
    // Format date
    let formattedDate = n.date || 'Tanggal tidak tersedia';
    if (n.date) {
      try {
        const dateObj = new Date(n.date);
        formattedDate = dateObj.toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        formattedDate = n.date;
      }
    }

    // Truncate content for preview
    const contentPreview = n.content && n.content.length > 150 
      ? n.content.substring(0, 150) + '...' 
      : n.content || 'Tidak ada deskripsi tersedia.';

    newsListEl.innerHTML += `
      <article class="news-card">
        <div class="news-image">
          <img src="${n.image || 'https://via.placeholder.com/600x400/123440/ffffff?text=Hydrovoltiger+News'}" 
               alt="${n.title || 'News Image'}"
               onerror="this.src='https://via.placeholder.com/600x400/123440/ffffff?text=Image+Not+Found'">
        </div>

        <div class="news-content">
          <div class="news-meta">
            <span class="news-category">${n.category || 'Umum'}</span>
            <span class="news-date">${formattedDate}</span>
          </div>

          <h3>${n.title || 'Judul Tidak Tersedia'}</h3>
          <p>${contentPreview}</p>

          <a href="#" class="read-more" onclick="alert('Fitur detail berita akan segera hadir!\\n\\nJudul: ${(n.title || '').replace(/'/g, "\\'")}'); return false;">
            Baca Selengkapnya →
          </a>
        </div>
      </article>
    `;
  });

  console.log(`✅ ${newsCount} news article(s) loaded from Firebase`);
}, error => {
  console.error("❌ Error loading news:", error);
  newsListEl.innerHTML = `
    <div style="grid-column: 1/-1; text-align:center; padding:40px 20px;">
      <p style="color:#e53e3e; font-size:1.1rem;">Error loading news. Please check console.</p>
    </div>
  `;
});