const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '5224733147:AAFaExlVjU0z8a4K2WL3HaqZkN0i79XX3Qo';
const bot = new TelegramBot(token, { polling: true });
const chatId = 224688427;
let remindsQueue = [];
let remindTimeID;


const App = () => {

    getTodos().map(t =>
        setReminderTimeout(chatId, t, t.datetime, t.frequency)
    )


    bot.onText(/\/get/, () => {
        const isRepeatableEvent = (t) => t.repeatable ? ` Повтор каждый ${t.frequency} день` : ''
        bot.sendMessage(chatId, getTodos()
            .map((todo, i) =>
                `${i + 1}. ${todo.message}; ${formatDate(todo.datetime)}${isRepeatableEvent(todo)}\n`)
            .join(''))
    })

    bot.onText(/\/add(.+)/, msg => {
        bot.sendMessage(chatId, 'Когда нужно напомнить?')
        bot.on('message', msg2 => {
            let periodRemind = msg2.text.split(' ')[0]
            let curYear = new Date().getFullYear()
            if (periodRemind.length < 10) {
                periodRemind = msg2.text.slice(0, 5) + '-' + curYear
            }
            periodRemind = periodRemind.split('-').reverse().join('-')
            const timeRemind = msg2.text.split(' ')[1]
            const datetimeValue = Date.parse(periodRemind + ' ' + timeRemind) + 3 * 60 * 60 * 1000
            bot.removeListener('message')
            bot.sendMessage(chatId, 'Через сколько дней повторить?')
            bot.on('message', msg3 => {
                const days = +msg3.text
                const todos = getTodos()
                todos.push({
                    message: msg.text.replace(/\/add./, ''),
                    datetime: datetimeValue,
                    repeatable: days !== 0,
                    frequency: days
                })
                writeTodos(todos)
                setReminderTimeout(chatId, todos[todos.length - 1], datetimeValue, days)
                let freqRes = '';
                days ? freqRes = `Повтор каждый ${days} день` : freqRes
                bot.sendMessage(chatId, `Добавлено! ${todos[todos.length - 1].message} ${formatDate(datetimeValue)}. ${freqRes}`)
                bot.removeListener('message')
            })
        })
    })

    bot.onText(/\/del/, msg => {
        bot.sendMessage(chatId, getTodos().map((todo, i) => `${i + 1}. ${todo.message}; ${formatDate(todo.datetime)}\n`).join(''))
        bot.sendMessage(msg.chat.id, 'Введите номер напоминания для удаления:')
        bot.on('message', msg2 => {
            if (/\d+/.test(msg2.text)) {
                let remindIndex = +msg2.text - 1
                bot.sendMessage(chatId, `Удалено: ${remindsQueue[remindIndex].name}`)
                clearTimeout(remindsQueue[remindIndex].ID)
                remindsQueue = remindsQueue.filter((_, i) => i != remindIndex)
                const filtered = getTodos().filter((_, i) => i != remindIndex)
                writeTodos(filtered)
            } else {
                bot.sendMessage(chatId, 'Ошибка, повторите попытку.')
            }
            bot.removeListener('message')
        })
    })
}


function getTodos() {
    const source = fs.readFileSync('./todos.json', 'utf-8');
    const todos = JSON.parse(source).source;
    return todos
}

function writeTodos(arr) {
    const todosToAdd = JSON.stringify({ source: arr }, null, 4)
    fs.writeFileSync('./todos.json', todosToAdd)
}

function formatDate(unixtime) {
    const jsDate = new Date(unixtime)

    const y = jsDate.getFullYear()
    const m = (jsDate.getMonth() + 1).toString().padStart(2, '0')
    const d = jsDate.getDate().toString().padStart(2, '0')
    const h = jsDate.getUTCHours().toString().padStart(2, '0')
    const min = jsDate.getMinutes().toString().padStart(2, '0')
    return `${d}-${m}-${y} ${h}:${min}`
}

function deleteTodo(dt) {
    writeTodos(getTodos().filter(t => dt !== t.datetime))
}

function setReminderTimeout(chatId, todo, dt, days) {
    let currentTime = new Date().getTime() + 3 * 60 * 60 * 1000
    let waitingTime = dt - currentTime
    if (!todo.repeatable) {
        remindTimeID = setTimeout(() => {
            bot.sendMessage(chatId, todo.message);
            deleteTodo(dt)
        },
            waitingTime
        )
        remindsQueue.push({ name: todo.message, ID: remindTimeID })
    } else {
        remindTimeID = setTimeout(() => {
            bot.sendMessage(chatId, todo.message)
            let otherTodos = getTodos().filter(t => t.message !== todo.message)
            todo.datetime = getNextDateRemind(dt, days)
            otherTodos.push(todo)
            writeTodos(otherTodos)
            setReminderTimeout(chatId, todo, getNextDateRemind(dt, days), days)
        },
            waitingTime
        )
        remindsQueue.push({ name: todo.message, ID: remindTimeID })
    }
}

function getNextDateRemind(UTCdate, days) {
    return UTCdate + days * 24 * 60 * 60 * 1000
}

App()