const firebaseConfig = {
  apiKey: "AIzaSyAOB-rSJQ4XDJyIQu6Totoqnoz6O2CkNP8",
  authDomain: "backlinks-b4154.firebaseapp.com",
  projectId: "backlinks-b4154",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const currentPath = window.location.pathname;

// Основная логика после успешной авторизации
async function afterAuth(user, userData) {
  const app = document.getElementById('app');
  if (app) {
    app.style.display = 'block'; // Только если есть app, показываем
  }

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

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Нет юзера
    if (currentPath === '/index.html') {
      // На главной — показываем логин
      if (document.getElementById('loginScreen')) {
        document.getElementById('loginScreen').style.display = 'block';
      }
      if (document.getElementById('mainApp')) {
        document.getElementById('mainApp').style.display = 'none';
      }
    } else {
      // Не на главной — кидаем на логин
      window.location.href = '/index.html';
    }
    return;
  }

  if (currentPath === '/index.html') {
    // На главной странице: показываем меню
    if (document.getElementById('loginScreen')) {
      document.getElementById('loginScreen').style.display = 'none';
    }
    if (document.getElementById('mainApp')) {
      document.getElementById('mainApp').style.display = 'block';
    }
    return;
  }

  // На внутренних страницах — проверяем базу
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists) {
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      window.location.href = '/index.html';
      return;
    }

    const userData = userDoc.data();
    if (userData.type !== 'admin' && userData.type !== 'user') {
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      window.location.href = '/index.html';
      return;
    }

    // Всё ок, грузим дальше
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
    window.location.href = '/index.html';
  }
});
