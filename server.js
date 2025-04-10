const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

const AHREFS_API_KEY = '9j1U-HU9dnyfJrHEgKL2dZKJRe5TLmT3BwslRh-b';
let mainStatsCache = null;    // кеш для основной статистики

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Email builder: load template
app.get('/api/template/:lang', (req, res) => {
  const lang = req.params.lang;
  const filePath = path.join(__dirname, 'templates', `${lang}.html`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Template not found');
  }
  const template = fs.readFileSync(filePath, 'utf-8');
  res.json({ template });
});

// Email builder: generate html
app.post('/api/generate', (req, res) => {
  const { lang, values } = req.body;
  const filePath = path.join(__dirname, 'templates', `${lang}.html`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Template not found');
  }
  let template = fs.readFileSync(filePath, 'utf-8');
  for (const key in values) {
    const regex = new RegExp(`%${key}%`, 'g');
    template = template.replace(regex, values[key]);
  }
  res.send(template);
});
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Получить письма, которые ещё не отправлены
app.get('/api/backlinks', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks').where('status', '==', 'new').get();
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (e) {
    console.error('Ошибка при получении ссылок:', e);
    res.status(500).json({ error: 'Ошибка при получении ссылок' });
  }
});

app.get('/api/project-backlinks-ready', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const snapshot = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('status', '==', 'new')
      .where('reStatus', '==', 'done')
      .get();

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (e) {
    console.error('Ошибка получения project-backlinks-ready:', e);
    res.status(500).json({ error: 'Ошибка при получении данных' });
  }
});


app.get('/api/backlinks/sent', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks').where('status', '==', 'sent').get();
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (e) {
    console.error('Ошибка при получении отправленных:', e);
    res.status(500).json({ error: 'Ошибка при получении отправленных' });
  }
});

app.post('/api/backlinks/:id/revert', async (req, res) => {
  try {
    await db.collection('backlinks').doc(req.params.id).update({
      status: 'new',
      sentAt: admin.firestore.FieldValue.delete()
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при возврате письма:', e);
    res.status(500).json({ error: 'Ошибка при возврате письма' });
  }
});

// Кол-во отправленных из mainProject
app.get('/api/project-backlinks/sent-count', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  try {
    const snap = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('status', '==', 'sent')
      .get();

    res.json({ count: snap.size });
  } catch (e) {
    console.error('Ошибка при получении отправленных (mainProject):', e);
    res.status(500).json({ error: 'Ошибка при подсчёте' });
  }
});

// Кол-во готовых к отправке из mainProject
app.get('/api/project-backlinks/to-send-count', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  try {
    const snap = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('reStatus', '==', 'done')
      .where('status', '==', 'new')
      .get();

    res.json({ count: snap.size });
  } catch (e) {
    console.error('Ошибка при подсчёте новых (mainProject):', e);
    res.status(500).json({ error: 'Ошибка при подсчёте' });
  }
});

// Кол-во невалидных из mainProject
app.get('/api/project-backlinks/invalid-count', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

  try {
    const snap = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('status', '==', 'invalid')
      .get();

    res.json({ count: snap.size });
  } catch (e) {
    console.error('Ошибка при подсчёте invalid (mainProject):', e);
    res.status(500).json({ error: 'Ошибка при подсчёте' });
  }
});

// Получить невалидные письма из проекта
app.get('/api/project-backlinks/invalid', async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const backlinksSnap = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('status', '==', 'invalid')
      .get();

    const backlinks = backlinksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(backlinks);
  } catch (err) {
    console.error('Ошибка при получении невалидных беклинков:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔍 Получить все ссылки из подколлекции, которые нужно исследовать
app.get('/api/project-backlinks/research', async (req, res) => {
  const projectId = req.query.projectId;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const snapshot = await db
      .collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('reStatus', '==', 'new')
      .where('email', '==', '')
      .get();

    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (e) {
    console.error('Ошибка при получении research-беклинков:', e);
    res.status(500).json({ error: 'Ошибка при получении данных' });
  }
});

// 🔢 Получить статистику по research (new/done/invalid)
app.get('/api/project-backlinks/research-counts', async (req, res) => {
  const projectId = req.query.projectId;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const statuses = ['new', 'done', 'invalid'];
    const result = {};

    for (const s of statuses) {
      const snap = await db
        .collection('mainProject')
        .doc(projectId)
        .collection('backlinks')
        .where('reStatus', '==', s)
        .get();

      result[s] = snap.size;
    }

    res.json(result);
  } catch (e) {
    console.error('Ошибка при подсчёте research-беклинков:', e);
    res.status(500).json({ error: 'Ошибка при подсчёте' });
  }
});

// Маркируем как "done" для подколлекции mainProject
app.post('/api/project-backlinks/:projectId/:id/mark-done', async (req, res) => {
  const { projectId, id } = req.params;
  const { email, contactPageUrl, contactFormUrl, researchAt } = req.body;

  try {
    await db
      .collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .doc(id)
      .update({
        reStatus: 'done',
        email,
        contactPageUrl,
        contactFormUrl,
        researchAt
      });

    res.json({ success: true });
  } catch (e) {
    console.error('❌ Ошибка при обновлении research/mark-done:', e);
    res.status(500).json({ error: 'Ошибка при обновлении mark-done' });
  }
});

// Маркируем как "invalid" для подколлекции mainProject
app.post('/api/project-backlinks/:projectId/:id/mark-invalid', async (req, res) => {
  const { projectId, id } = req.params;
  const { reason } = req.body;

  try {
    await db
      .collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .doc(id)
      .update({
        reStatus: 'invalid',
        email_reason: reason || 'unknown'
      });

    res.json({ success: true });
  } catch (e) {
    console.error('❌ Ошибка при обновлении research/mark-invalid:', e);
    res.status(500).json({ error: 'Ошибка при обновлении mark-invalid' });
  }
});




// Получение всех шаблонов проекта
app.get('/api/project-templates/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const snapshot = await db.collection('mainProject').doc(projectId).collection('templates').get();
    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Сохранение нового шаблона проекта
app.post('/api/project-templates/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { name, html, subject } = req.body;

  if (!name || !html) {
    return res.status(400).json({ error: 'Missing name or html' });
  }

  try {
    const templateRef = db.collection('mainProject').doc(projectId).collection('templates').doc(name);
    const doc = await templateRef.get();
    if (doc.exists) {
      return res.status(400).json({ error: 'Template with this name already exists' });
    }

    await templateRef.set({
      name,
      subject,
      html,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// Удаление шаблона проекта
app.delete('/api/project-templates/:projectId/:templateId', async (req, res) => {
  const { projectId, templateId } = req.params;

  try {
    await db.collection('mainProject').doc(projectId).collection('templates').doc(templateId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});


app.post('/api/project-backlinks/:projectId/add', async (req, res) => {
  const { projectId } = req.params;
  const entry = req.body;

  if (!projectId || !entry || !entry.url || !entry.mainDomain) {
    return res.status(400).json({ error: 'Данные невалидны' });
  }

  try {
    await db
      .collection('mainProject')          // 🔹 коллекция mainProject
      .doc(projectId)                     // 🔹 конкретный проект
      .collection('backlinks')            // 🔹 подколлекция backlinks внутри проекта
      .add(entry);                        // 🔹 добавляем новую ссылку

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка добавления в подколлекцию:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔍 Проверка отправленных ссылок внутри проекта
app.post('/api/project-backlinks/check-sent', async (req, res) => {
  const { projectId, ids } = req.body;
  if (!projectId || !Array.isArray(ids)) return res.status(400).json({ error: 'projectId и ids обязательны' });

  const results = [];
  const concurrency = 5;
  let index = 0;

  const refs = await Promise.all(ids.map(async id => {
    const snap = await db.collection('mainProject').doc(projectId).collection('backlinks').doc(id).get();
    return { id, url: snap.data()?.url };
  }));

  async function checkSingleLink({ id, url }) {
    const result = { id, url, status: '' };
    try {
      const response = await fetch(url, { timeout: 15000 });
      const text = await response.text();
      result.status = text.includes('ellington-hotel.com-en.com') ? 'yes' : 'no';
    } catch {
      result.status = 'error';
    }

    try {
      await db.collection('mainProject').doc(projectId).collection('backlinks').doc(id).update({
        check_url_change: result.status
      });
    } catch (e) {
      console.error(`Ошибка обновления Firestore для ${id}:`, e);
    }

    return result;
  }

  async function runBatch() {
    while (index < refs.length) {
      const batch = [];
      for (let i = 0; i < concurrency && index < refs.length; i++, index++) {
        batch.push(checkSingleLink(refs[index]));
      }
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
  }

  await runBatch();
  res.json(results);
});
//создание проекта
app.post('/api/create-project', async (req, res) => {
  const { name, mainDomain, userIds, clonDomain, redirectUrl, dateCreate } = req.body;

  if (!name || !mainDomain || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Данные невалидны' });
  }

  try {
    await db.collection('mainProject').add({
      name,
      mainDomain,
      userIds,
      clonDomain: clonDomain || '',   // если не передано, записать пустую строку
      redirectUrl: redirectUrl || '', // если не передано, записать пустую строку
      dateCreate: dateCreate || new Date().toISOString(), // если не передано, ставим сейчас
      project_status: 'isSubdomainAndArchivarix', // 🟣 дефолтный статус
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при создании проекта:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});




// Получить отправленные письма из проекта
app.get('/api/project-backlinks/sent', async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  try {
    const backlinksSnap = await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .where('status', '==', 'sent')
      .get();

    const backlinks = backlinksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(backlinks);
  } catch (err) {
    console.error('Ошибка при получении отправленных беклинков:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// Пометить письмо как отправленное
// ПОМЕТИТЬ КАК ОТПРАВЛЕННОЕ + ДОП.ПОЛЯ
app.post('/api/project-backlinks/:projectId/:id/send', async (req, res) => {
  try {
    const { email, contactPageUrl, contactFormUrl, sentAt, emailLang, lang } = req.body;
    const { projectId, id } = req.params;

    const data = { status: 'sent' };
    if (email) data.email = email;
    if (contactPageUrl) data.contactPageUrl = contactPageUrl;
    if (contactFormUrl) data.contactFormUrl = contactFormUrl;
    if (sentAt) data.sentAt = sentAt;
    if (emailLang) data.emailLang = emailLang;
    if (lang) data.lang = lang;

    await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .doc(id)
      .update(data);

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при обновлении статуса (sent):', e);
    res.status(500).json({ error: 'Ошибка при обновлении' });
  }
});


app.get('/api/research/backlinks', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('reStatus', '==', 'new')
      .where('email', '==', '') // 🔥 Показываем только те, у кого ещё НЕТ емейла
      .get();
    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (e) {
    console.error('Ошибка при получении research-беклинков:', e);
    res.status(500).json({ error: 'Ошибка при получении данных' });
  }
});

app.post('/api/backlinks/:id/changed', async (req, res) => {
  try {
    const { changed, check_url_change } = req.body;
const update = {};

if (changed) update.changed = changed;
if (check_url_change) update.check_url_change = check_url_change;

await db.collection('backlinks').doc(req.params.id).update(update);


    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при отметке changed:', e);
    res.status(500).json({ error: 'Ошибка при обновлении' });
  }
});


app.get('/api/backlinks/done-count', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('reStatus', '==', 'done')
      .get();

    res.json({ count: snapshot.size });
  } catch (e) {
    console.error('Ошибка при получении количества done:', e);
    res.status(500).json({ error: 'Ошибка при получении количества done' });
  }
});

app.get('/api/backlinks/ready-to-send', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('reStatus', '==', 'done')
      .where('status', '==', 'new')
      .get();

    const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(links);
  } catch (e) {
    console.error('Ошибка при получении готовых к отправке беклинков:', e);
    res.status(500).json({ error: 'Ошибка при получении беклинков' });
  }
});

app.get('/api/backlinks/to-send-count', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('reStatus', '==', 'done')
      .where('status', '==', 'new')
      .get();

    res.json({ count: snapshot.size });
  } catch (e) {
    console.error('Ошибка при получении количества к отправке:', e);
    res.status(500).json({ error: 'Ошибка при подсчете' });
  }
});



app.post('/api/research/backlinks/:id/mark-done', async (req, res) => {
  try {
    const { email, contactPageUrl, contactFormUrl, researchAt } = req.body;

    await db.collection('backlinks').doc(req.params.id).update({
      reStatus: 'done',
      email,
      contactPageUrl,
      contactFormUrl,
      researchAt
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при пометке как done:', e);
    res.status(500).json({ error: 'Ошибка при обновлении' });
  }
});

app.post('/api/research/backlinks/:id/mark-invalid', async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('backlinks').doc(req.params.id).update({
      reStatus: 'invalid',
      email_reason: reason
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при пометке invalid (research):', e);
    res.status(500).json({ error: 'Ошибка при обновлении' });
  }
});

app.get('/api/research/counts', async (req, res) => {
  try {
    const statuses = ['new', 'done', 'invalid'];
    const result = {};

    for (const s of statuses) {
      const snap = await db.collection('backlinks')
        .where('reStatus', '==', s)
        .get();
      result[s] = snap.size;
    }

    res.json(result);
  } catch (e) {
    console.error('Ошибка при подсчёте:', e);
    res.status(500).json({ error: 'Ошибка подсчёта' });
  }
});


app.post('/api/project-backlinks/:projectId/:id/invalidate', async (req, res) => {
  try {
    const { reason } = req.body;
    const { projectId, id } = req.params;

    await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .doc(id)
      .update({
        status: 'invalid',
        reason: reason || ''
      });

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при пометке как невалидный:', e);
    res.status(500).json({ error: 'Ошибка при обновлении' });
  }
});



// Новый маршрут для проверки ссылок отправленных и сохранения результатов в Firestore
app.post('/api/backlinks/check-sent', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Missing ids' });

  const results = [];
  const concurrency = 5;
  let index = 0;

  const refs = await Promise.all(ids.map(async id => {
    const snap = await db.collection('backlinks').doc(id).get();
    return { id, url: snap.data()?.url };
  }));

  async function checkSingleLink({ id, url }) {
    const result = { id, url, status: '' };
    try {
      const response = await fetch(url, { timeout: 15000 });
      const text = await response.text();
      result.status = text.includes('ellington-hotel.com-en.com') ? 'yes' : 'no';
    } catch {
      result.status = 'error';
    }

    try {
      await db.collection('backlinks').doc(id).update({ check_url_change: result.status });
    } catch (e) {
      console.error(`Ошибка обновления Firestore для ${id}:`, e);
    }

    return result;
  }

  async function runBatch() {
    while (index < refs.length) {
      const batch = [];
      for (let i = 0; i < concurrency && index < refs.length; i++, index++) {
        batch.push(checkSingleLink(refs[index]));
      }
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
  }

  await runBatch();
  res.json(results);
});


//Получить проекты
app.get('/api/user-projects', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const projectsSnap = await db.collection('mainProject')
  .where('userIds', 'array-contains', userId)
  .get();

    const projects = [];

    for (const projectDoc of projectsSnap.docs) {
      const project = projectDoc.data();
      const mainDomain = project.mainDomain;

      const backlinksSnap = await db.collection('mainProject')
    .doc(projectDoc.id)
    .collection('backlinks')
    .get();

      const backlinks = backlinksSnap.docs.map(doc => doc.data());

      const total = backlinks.length;
      const emailsSent = backlinks.filter(b => b.status === 'sent').length;
      const parsedCount = backlinks.filter(b => b.check_url_change === 'yes').length;
      const emailResearch = backlinks.filter(b => b.reStatus === 'done').length;
      const hasResearchLeft = backlinks.some(b => b.reStatus !== 'done');

      let project_status = project.project_status || 'isSubdomainAndArchivarix';

      if (total >= 1) {
        const allReStatusDone = backlinks.every(b => b.reStatus !== 'new');
        const allStatusDone = backlinks.every(b => b.status !== 'new');
      
        if (allReStatusDone) project_status = 'send_emails';
        if (allStatusDone) project_status = 'check_admin';
      }

      projects.push({
        projectId: projectDoc.id,
        mainDomain,
        name: project.name || '', // если у тебя есть поле name
        backlinks: total,
        emailsSent,
        parsedCount,
        emailResearch,
        hasResearchLeft,
        project_status,
        clonDomain: project.clonDomain || '',
        redirectUrl: project.redirectUrl || '',
        dateCreate: project.dateCreate || project.createdAt || '',
        userIds: project.userIds || [],   // ✅ Обязательно добавь эту строчку
      });
    }

    res.json(projects);
  } catch (e) {
    console.error('Ошибка при получении проектов пользователя:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/all-users', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email
    }));
    res.json(users);
  } catch (err) {
    console.error('❌ Ошибка при получении списка пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.patch('/api/project/:id', async (req, res) => {
  const { id } = req.params;
  const { name, mainDomain, userIds, project_status, clonDomain, redirectUrl } = req.body;

  try {
    const update = {};
    if (name !== undefined) update.name = name;
    if (mainDomain !== undefined) update.mainDomain = mainDomain;
    if (userIds !== undefined) update.userIds = userIds;
    if (project_status !== undefined) update.project_status = project_status;
    if (clonDomain !== undefined) update.clonDomain = clonDomain;    // 👈 обязательно добавить
    if (redirectUrl !== undefined) update.redirectUrl = redirectUrl; // 👈 обязательно добавить

    await db.collection('mainProject').doc(id).update(update);
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка обновления проекта:', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});


app.post('/api/project-backlinks/:projectId/add', async (req, res) => {
  const { projectId } = req.params;
  const data = req.body;

  if (!data.url || !data.mainDomain) {
    return res.status(400).json({ error: 'Недостаточно данных' });
  }

  try {
    await db.collection('mainProject')
      .doc(projectId)
      .collection('backlinks')
      .add(data);

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка добавления бэка:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//Заполнить userID 
app.post('/api/backlinks/bulk-assign-user', async (req, res) => {
  const { mainDomain, userId } = req.body;

  if (!mainDomain || !userId) {
    return res.status(400).json({ error: 'mainDomain and userId are required' });
  }

  try {
    const snapshot = await db.collection('backlinks')
      .where('mainDomain', '==', mainDomain)
      .get();

    const batch = db.batch();

    snapshot.forEach(doc => {
      console.log(`Назначаю userId ${userId} для ${mainDomain}`);
console.log('Найдено документов:', snapshot.size);

      batch.update(doc.ref, { userId });
    });

    await batch.commit();
    res.json({ success: true, updated: snapshot.size });
  } catch (err) {
    console.error('Ошибка при массовом обновлении userId:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/api/backlinks/invalid-count', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('status', '==', 'invalid')
      .get();

    res.json({ count: snapshot.size });
  } catch (e) {
    console.error('Ошибка при получении количества невалидных:', e);
    res.status(500).json({ error: 'Ошибка при получении количества невалидных' });
  }
});

app.get('/api/backlinks/invalid', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('status', '==', 'invalid')
      .get();

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (e) {
    console.error('Ошибка при получении невалидных писем:', e);
    res.status(500).json({ error: 'Ошибка при получении невалидных писем' });
  }
});

app.post('/api/backlinks', async (req, res) => {
  try {
    const { url, lang, email = '', status, mainDomain, emailLang } = req.body;

    if (!url || !mainDomain) {
      return res.status(400).json({ error: 'url и mainDomain обязательны' });
    }

    // ⛔️ Проверка на дубликат по url + email
    const existsSnap = await db.collection('backlinks')
      .where('url', '==', url)
      .where('mainDomain', '==', mainDomain)
      .limit(1)
      .get();

    if (!existsSnap.empty) {
      // Беклинк уже существует, обновляем только lang
      const docId = existsSnap.docs[0].id;

      await db.collection('backlinks').doc(docId).set({
        lang: lang && lang.trim() !== "" ? lang.trim() : null  // Если lang пустой, записываем null
      }, { merge: true });

      console.log('Обновление существующего беклинка с новым значением языка');
    } else {
      // Если беклинк не существует, создаем новый
      const entry = {
        url,
        lang: lang && lang.trim() !== "" ? lang.trim() : null,  // Если lang пустой, записываем null
        email: '',  // email будет пустым при загрузке
        mainDomain: mainDomain.trim() || '',
        status: 'new',
        reStatus: 'new',
        createdAt: new Date().toISOString()
      };

      await db.collection('backlinks').add(entry);
      console.log('Добавление нового беклинка');
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка при загрузке и обновлении беклинков:', e);
    res.status(500).json({ error: 'Ошибка при загрузке данных' });
  }
});


app.get('/api/backlinks/sent-count', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('status', '==', 'sent')
      .get();

    res.json({ count: snapshot.size });
  } catch (e) {
    console.error('Ошибка при получении количества отправленных:', e);
    res.status(500).json({ error: 'Ошибка при получении количества отправленных' });
  }
});

app.get('/api/backlinks/new-count', async (req, res) => {
  try {
    const snapshot = await db.collection('backlinks')
      .where('status', '==', 'new')
      .get();

    res.json({ count: snapshot.size });
  } catch (e) {
    console.error('Ошибка при получении количества новых:', e);
    res.status(500).json({ error: 'Ошибка при получении количества новых' });
  }
});


// Link checker: check links from urls.txt
app.get('/check-links', async (req, res) => {
  const urls = fs.readFileSync(path.join(__dirname, 'urls.txt'), 'utf-8')
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean);

  const results = [];
  const concurrency = 5;
  let index = 0;

  async function checkSingleLink(url) {
    const result = { url, status: '', dr: '-' };
    try {
      const response = await fetch(url, { timeout: 15000 });
      const text = await response.text();
      result.status = text.includes('ellington-hotel.com-en.com') ? 'Есть ссылка' : 'Нет ссылка';
    } catch {
      result.status = 'Ошибка';
    }
    return result;
  }

  async function runBatch() {
    while (index < urls.length) {
      const batch = [];
      for (let i = 0; i < concurrency && index < urls.length; i++, index++) {
        batch.push(checkSingleLink(urls[index]));
      }
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
  }

  await runBatch();
  res.json(results);
});

// Ahrefs DR for domains
// Ahrefs DR for domains
app.post('/fetch-dr', async (req, res) => {
  const domains = req.body.domains;
  const results = {};
  const today = new Date().toISOString().split('T')[0];

  for (const domain of domains) {
    try {
      const target = encodeURIComponent(domain);
      const apiUrl = `https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${target}&date=${today}&output=json&protocol=both`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${AHREFS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      results[domain] = data.domain_rating?.domain_rating ?? '-';
    } catch (err) {
      results[domain] = '-';
    }
  }

  res.json(results);
});


// Ahrefs stats for main domain
app.post('/fetch-main-stats', async (req, res) => {
  const force = req.body.force === true; // если передали force: true — сбрасываем кеш

  // Если есть кеш и не force — отдаем его
  if (!force && mainStatsCache && mainStatsCache.expires > Date.now()) {
    return res.json(mainStatsCache.data);
  }

  const domain = 'ellington-hotel.com-en.com';
  const today = new Date().toISOString().split('T')[0];

  try {
    const apiUrl = `https://api.ahrefs.com/v3/site-explorer/backlinks-stats?target=${domain}&date=${today}&output=json`;
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${AHREFS_API_KEY}`,
        'Accept': 'application/json, application/xml'
      }
    });

    const data = await response.json();
    const result = {
      backlinks: data.metrics?.all_time ?? '-',
      refDomains: data.metrics?.all_time_refdomains ?? '-'
    };

    // Кешируем на 12 часов
    mainStatsCache = {
      data: result,
      expires: Date.now() + 12 * 60 * 60 * 1000
    };

    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении статистики основного домена:', error);
    res.json({ backlinks: '-', refDomains: '-' });
  }
});


// Ahrefs refdomains for specific domain
app.post('/fetch-refdomains', async (req, res) => {
  const domain = req.body.domain;
  const apiUrl = `https://api.ahrefs.com/v3/site-explorer/refdomains?target=${domain}&history=live&limit=50&mode=subdomains&order_by=domain_rating%3Adesc%2Ctraffic_domain%3Adesc&protocol=both&select=domain%2Clinks_to_target%2Cfirst_seen%2Clast_seen%2Cdomain_rating%2Cdofollow_refdomains%2Cdofollow_linked_domains%2Ctraffic_domain%2Cpositions_source_domain%2Cnew_links%2Clost_links%2Cdofollow_links&output=json`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${AHREFS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const results = data?.refdomains?.map(d => ({
      domain: d.domain || '-',
      domain_rating: d.domain_rating ?? '-',
      links_to_target: d.links_to_target ?? '-',
      traffic_domain: d.traffic_domain ?? '-',
      first_seen: d.first_seen || '-',
      last_seen: d.last_seen || '-'
    })) || [];

    res.json(results);
  } catch (err) {
    console.error('Ошибка при получении refdomains:', err);
    res.json([]);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен: http://0.0.0.0:${PORT}`);
});



const axios = require('axios');
const cheerio = require('cheerio');

// ================================
// 🔥 СОЗДАНИЕ ПРОЕКТА HOTELS
// ================================
app.post('/api/hotels-city/create', async (req, res) => {
  try {
    const { city, listingUrl } = req.body;
    if (!city || !listingUrl) return res.status(400).json({ error: 'City and Listing URL are required' });

    const newProject = await db.collection('hotels_city').add({
      city,
      listingUrl,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: newProject.id });
  } catch (err) {
    console.error('Error creating hotel project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ================================
// 🔥 ПОЛУЧЕНИЕ ВСЕХ ПРОЕКТОВ HOTELS
// ================================
app.get('/api/hotels-city', async (req, res) => {
  try {
    const snapshot = await db.collection('hotels_city').get();
    const projects = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Считаем количество отелей
      const hotelsSnapshot = await db.collection('hotels_city').doc(doc.id).collection('hotels').get();
      const hotelsCount = hotelsSnapshot.size;

      projects.push({ id: doc.id, ...data, hotelsCount });
    }

    res.json(projects);
  } catch (err) {
    console.error('Error fetching hotel projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ================================
// 🔥 ПАРСИНГ ОТЕЛЕЙ ПО ЛИСТИНГУ
// ================================
app.post('/api/hotels-city/:projectId/parse', async (req, res) => {
  const { projectId } = req.params;

  try {
    const projectDoc = await db.collection('hotels_city').doc(projectId).get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });

    const { listingUrl } = projectDoc.data();

    const response = await axios.get(listingUrl);
    const $ = cheerio.load(response.data);

    const hotels = [];

    $('.hl-hotel-card').each((_, el) => {
      const hotelId = $(el).attr('data-hid');
      const hotelName = $(el).find('.hotel-info__title a').text().trim();

      if (hotelId && hotelName) {
        hotels.push({
          hotelId,
          name: hotelName,
          email: '',
          contactPageUrl: '',
          formUrl: '',
          status: 'new'
        });
      }
    });

    const batch = db.batch();
    const hotelsCollection = db.collection('hotels_city').doc(projectId).collection('hotels');

    hotels.forEach(hotel => {
      const docRef = hotelsCollection.doc(hotel.hotelId);
      batch.set(docRef, hotel);
    });

    await batch.commit();

    res.json({ success: true, hotelsParsed: hotels.length });
  } catch (err) {
    console.error('Error parsing hotels:', err);
    res.status(500).json({ error: 'Failed to parse hotels' });
  }
});

// 🔥 Отметить отель как \"Готово\" и сохранить данные
app.post('/api/hotels-city/:projectId/hotels/:hotelId/mark-done', async (req, res) => {
  const { projectId, hotelId } = req.params;
  const { email, contactPageUrl, formUrl } = req.body;

  try {
    await db.collection('hotels_city').doc(projectId)
      .collection('hotels').doc(hotelId)
      .update({
        email,
        contactPageUrl,
        formUrl,
        status: 'done'
      });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking hotel as done:', err);
    res.status(500).json({ error: 'Failed to mark as done' });
  }
});

// 🔥 Отметить отель как \"Невалидный\"
app.post('/api/hotels-city/:projectId/hotels/:hotelId/mark-invalid', async (req, res) => {
  const { projectId, hotelId } = req.params;

  try {
    await db.collection('hotels_city').doc(projectId)
      .collection('hotels').doc(hotelId)
      .update({
        status: 'invalid'
      });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking hotel as invalid:', err);
    res.status(500).json({ error: 'Failed to mark as invalid' });
  }
});

// ================================
// 🔥 ПОЛУЧИТЬ ВСЕ ОТЕЛИ ДЛЯ ПРОЕКТА
// ================================
app.get('/api/hotels-city/:projectId/hotels', async (req, res) => {
  const { projectId } = req.params;

  try {
    const hotelsSnapshot = await db.collection('hotels_city')
      .doc(projectId)
      .collection('hotels')
      .get();

    const hotels = hotelsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(hotels);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// ================================
// 🔥 ПОЛУЧИТЬ ОДИН ПРОЕКТ ПО ID
// ================================
app.get('/api/hotels-city/:projectId', async (req, res) => {
  const { projectId } = req.params;

  try {
    const projectDoc = await db.collection('hotels_city').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ id: projectDoc.id, ...projectDoc.data() });
  } catch (err) {
    console.error('Error fetching hotel project:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/hotels-city/:projectId/hotels/:hotelId/send', async (req, res) => {
  const { projectId, hotelId } = req.params;

  try {
    await db.collection('hotels_city').doc(projectId)
      .collection('hotels').doc(hotelId)
      .update({
        status: 'sent',
        sentAt: new Date().toISOString()
      });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking hotel as sent:', err);
    res.status(500).json({ error: 'Failed to mark as sent' });
  }
});

// Сохранение нового шаблона для hotels_city
app.post('/api/hotels-city/:projectId/templates', async (req, res) => {
  const { projectId } = req.params;
  const { name, html, subject } = req.body;

  if (!name || !html) {
    return res.status(400).json({ error: 'Missing name or html' });
  }

  try {
    const templateRef = db.collection('hotels_city').doc(projectId).collection('templates').doc(name);
    const doc = await templateRef.get();
    if (doc.exists) {
      return res.status(400).json({ error: 'Template with this name already exists' });
    }

    await templateRef.set({
      name,
      subject,
      html,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving hotel template:', error);
    res.status(500).json({ error: 'Failed to save hotel template' });
  }
});

// Получить все шаблоны для проекта отелей
app.get('/api/hotels-city/:projectId/templates', async (req, res) => {
  const { projectId } = req.params;

  try {
    const templatesSnapshot = await db.collection('hotels_city').doc(projectId).collection('templates').get();
    const templates = templatesSnapshot.docs.map(doc => doc.data());

    res.json(templates);
  } catch (error) {
    console.error('Error loading hotel templates:', error);
    res.status(500).json({ error: 'Failed to load hotel templates' });
  }
});

// Получить все отправленные письма для проекта отелей
app.get('/api/hotels-city/:projectId/sent', async (req, res) => {
  const { projectId } = req.params;

  try {
    // Забираем проект, чтобы получить listingUrl
    const projectDoc = await db.collection('hotels_city').doc(projectId).get();
    const projectData = projectDoc.data();
    const listingUrl = projectData?.listingUrl || '';

    // Загружаем отели
    const snapshot = await db.collection('hotels_city').doc(projectId).collection('hotels')
      .where('status', '==', 'sent')
      .get();

    const sentHotels = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.hotelId || doc.id, // ID отеля
        name: data.name || '',       // Название отеля
        url: listingUrl ? `${listingUrl}?recommended_hotel_id=${data.hotelId}` : '', // Конкатенация ссылки
        sentAt: data.sentAt || '',   // Дата отправки
      };
    });

    res.json(sentHotels);
  } catch (error) {
    console.error('Error loading sent hotels:', error);
    res.status(500).json({ error: 'Failed to load sent hotels' });
  }
});

// Получить все письма со статусом "done"
app.get('/api/hotels-city/:projectId/remaining', async (req, res) => {
  const { projectId } = req.params;

  try {
    const snapshot = await db.collection('hotels_city').doc(projectId).collection('hotels')
      .where('status', '==', 'done')
      .get();

    const remainingHotels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(remainingHotels);
  } catch (error) {
    console.error('Error loading remaining hotels:', error);
    res.status(500).json({ error: 'Failed to load remaining hotels' });
  }
});






