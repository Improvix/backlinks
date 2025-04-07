const firebaseConfig = {
  apiKey: "AIzaSyAOB-rSJQ4XDJyIQu6Totoqnoz6O2CkNP8",
  authDomain: "backlinks-b4154.firebaseapp.com",
  projectId: "backlinks-b4154",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Проверка авторизации и наличия в базе
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/blinks.html'; // Страница логина
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      // ❌ Пользователь НЕ найден в базе — выкидываем
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      window.location.href = '/blinks.html'; // или отдельная страница "access denied"
      return;
    }

    const userData = userDoc.data();
    if (userData.type !== 'admin' && userData.type !== 'user') {
      // ❌ Если статус не admin и не user — тоже выкидываем
      alert('⛔️ Доступ запрещен. Обратитесь к администратору.');
      await auth.signOut();
      window.location.href = '/blinks.html';
      return;
    }

    // ✅ Всё ок, пускаем дальше
  } catch (e) {
    console.error('Ошибка проверки пользователя:', e);
    alert('Ошибка проверки пользователя.');
    await auth.signOut();
    window.location.href = '/blinks.html';
  }
});
