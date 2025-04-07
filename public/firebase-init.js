const firebaseConfig = {
  apiKey: "AIzaSyAOB-rSJQ4XDJyIQu6Totoqnoz6O2CkNP8",
  authDomain: "backlinks-b4154.firebaseapp.com",
  projectId: "backlinks-b4154",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const currentPath = window.location.pathname;

// Основная логика после авторизации
function afterAuth(user, userData) {
  document.getElementById('app').style.display = 'block';

  if (currentPath !== '/index.html') {
    const isAdmin = userData.type === 'admin';

    if (typeof loadProjects === 'function') {
      loadProjects(user.uid, isAdmin);
    }
    if (typeof loadAllUsers === 'function') {
      loadAllUsers();
    }

    if (document.getElementById('logoutBtn')) {
      document.getElementById('logoutBtn').innerText = user.displayName || 'Выйти';
    }
  }
}

// Проверка авторизации и наличия в базе
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    if (currentPath !== '/index.html') {
      window.location.href = '/index.html';
    }
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      if (currentPath !== '/index.html') {
        window.location.href = '/index.html';
      }
      return;
    }

    const userData = userDoc.data();
    if (userData.type !== 'admin' && userData.type !== 'user') {
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      if (currentPath !== '/index.html') {
        window.location.href = '/index.html';
      }
      return;
    }

    // 🆕 Ждём загрузки страницы если нужно
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        afterAuth(user, userData);
      });
    } else {
      afterAuth(user, userData);
    }
    
  } catch (e) {
    console.error('Ошибка проверки пользователя:', e);
    alert('Ошибка проверки пользователя.');
    await auth.signOut();
    if (currentPath !== '/index.html') {
      window.location.href = '/index.html';
    }
  }
});
