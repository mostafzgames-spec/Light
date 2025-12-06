const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();

// ========================================================
// ⚙️ لوحة التحكم (عدل بياناتك هنا قبل الرفع)
// ========================================================
const CONFIG = {
    // 1. ضع توكن البوت الخاص بك هنا
    botToken: 'ضع_توكن_البوت_هنا_بين_علامات_التنصيص', 
    
    // 2. إعدادات التعدين
    mining: {
        baseRate: 0.00000012, // السرعة بالثانية (مجاني)
        cycleHours: 3,        // مدة التعدين بالساعات
        referralBonus: 0.05   // نسبة ربح الاحالة (5%)
    },
    
    // 3. الخطط
    plans: {
        'free': { multiplier: 1, name: "Free" },
        'vip1': { multiplier: 15, name: "VIP x15", price: 10 } 
    }
};
// ========================================================

app.use(bodyParser.json());
app.use(express.static('public')); 

// قاعدة بيانات في الذاكرة مؤقتاً (للبساطة)
// في التطبيق الحقيقي يفضل استخدام MongoDB، لكن هذا الملف سيعمل جيداً للتجربة
let db = { users: {} };

// إعداد البوت
const bot = new TelegramBot(CONFIG.botToken, { polling: true });

// أوامر البوت
bot.onText(/\/start (.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const referrerId = match[1]; 

    // تحديد رابط الموقع تلقائياً من سيرفر ريندر
    const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://google.com';

    if (!db.users[chatId]) {
        db.users[chatId] = {
            id: chatId,
            balance: 0,
            miningStart: null,
            plan: 'free',
            referrer: referrerId ? referrerId : null
        };
        // مكافأة الاحالة (اشعار فقط)
        if (referrerId && db.users[referrerId]) {
             bot.sendMessage(referrerId, "🎉 لديك إحالة جديدة!");
        }
    }

    bot.sendMessage(chatId, "👋 أهلاً بك في بوت التعدين!\n\nاضغط بالأسفل لبدء جمع الأرباح.", {
        reply_markup: {
            inline_keyboard: [[{ text: "🚀 فتح التطبيق", web_app: { url: appUrl } }]]
        }
    });
});

// === API ===

app.get('/api/user', (req, res) => {
    const userId = req.query.id;
    if (db.users[userId]) res.json(db.users[userId]);
    else res.json({ error: "User not found" });
});

app.post('/api/start', (req, res) => {
    const { userId } = req.body;
    if (!db.users[userId]) return res.json({ success: false });
    
    // بدء العداد
    db.users[userId].miningStart = Date.now();
    res.json({ success: true });
});

app.post('/api/claim', (req, res) => {
    const { userId } = req.body;
    const user = db.users[userId];
    if (!user || !user.miningStart) return res.json({ success: false });

    const now = Date.now();
    let seconds = (now - user.miningStart) / 1000;
    const maxSeconds = CONFIG.mining.cycleHours * 3600;
    
    if (seconds > maxSeconds) seconds = maxSeconds;

    const multiplier = CONFIG.plans[user.plan].multiplier;
    const earned = seconds * CONFIG.mining.baseRate * multiplier;

    user.balance += earned;
    user.miningStart = null;

    // إضافة نسبة الاحالة
    if (user.referrer && db.users[user.referrer]) {
        db.users[user.referrer].balance += (earned * CONFIG.mining.referralBonus);
    }

    res.json({ success: true, earned });
});

app.post('/api/withdraw', (req, res) => {
    // هنا يتم وضع كود FaucetPay لاحقاً
    res.json({ success: true, msg: "سيتم التفعيل قريباً" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

