const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '5224733147:AAFaExlVjU0z8a4K2WL3HaqZkN0i79XX3Qo';
const bot = new TelegramBot(token, { polling: true });
const chatId = 224688427;
let remindsQueue = [];


function App() {

    getTodosFromJSON().map(t =>
        setReminderTimeout(chatId, t, t.datetime, t.frequency)
    )

    bot.onText(/\/console/, () => {
        console.log(remindsQueue)
    })

    bot.onText(/\/get/, () => {
        sendAllTodos()
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
                const todos = getTodosFromJSON()
                todos.push({
                    message: msg.text.replace(/\/add./, ''),
                    datetime: datetimeValue,
                    repeatable: days !== 0,
                    frequency: days
                })
                writeTodosToJSON(todos)
                setReminderTimeout(chatId, todos[todos.length - 1], datetimeValue, days)
                let freqRes = '';
                days ? freqRes = `Повтор каждый ${days} день` : freqRes
                bot.sendMessage(chatId, `Добавлено! ${todos[todos.length - 1].message} ${formatDate(datetimeValue)}. ${freqRes}`)
                bot.removeListener('message')
            })
        })
    })

    bot.onText(/\/del/, msg => {
        sendAllTodos()

        bot.sendMessage(msg.chat.id, 'Введите номер напоминания для удаления:')
        bot.on('message', msg2 => {
            if (/\d+/.test(msg2.text)) {

                let remindIndex = +msg2.text - 1
                let remindMessage = getTodosFromJSON()[remindIndex].message
                const filtered = getTodosFromJSON().filter(item => item.message != remindMessage)
                writeTodosToJSON(filtered)

                clearTimeout(remindsQueue.find(item => item.name == remindMessage).ID)
                remindsQueue = remindsQueue.filter(item => item.name != remindMessage)

                bot.sendMessage(chatId, `Удалено: ${remindMessage}`)
            } else {
                bot.sendMessage(chatId, 'Ошибка, повторите попытку.')
            }
            bot.removeListener('message')
        })
    })
}

function sendAllTodos() {
    const isRepeatableEvent = (t) => t.repeatable ? ` Повтор каждый ${t.frequency} день` : ''
    bot.sendMessage(chatId, getTodosFromJSON()
        .map((todo, i) =>
            `${i + 1}. ${todo.message}; ${formatDate(todo.datetime)}${isRepeatableEvent(todo)}\n`)
        .join(''))
}

function getTodosFromJSON() {
    const source = fs.readFileSync('./todos.json', 'utf-8');
    const todos = JSON.parse(source).source;
    return todos
}

function writeTodosToJSON(arr) {
    const todosToAdd = JSON.stringify({ source: arr }, null, 4)
    fs.writeFileSync('./todos.json', todosToAdd)
}

function formatDate(unixtime) {
    const jsDate = new Date(unixtime)

    const y = jsDate.getUTCFullYear()
    const m = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const d = jsDate.getUTCDate().toString().padStart(2, '0')
    const h = jsDate.getUTCHours().toString().padStart(2, '0')
    const min = jsDate.getUTCMinutes().toString().padStart(2, '0')
    return `${d}-${m}-${y} ${h}:${min}`
}

function deleteTodoJSON(dt) {
    writeTodosToJSON(getTodosFromJSON().filter(t => dt !== t.datetime))
}

async function setReminderTimeout(chatId, todo, dt, days) {
    let currentTime = new Date().getTime() + 3 * 60 * 60 * 1000
    console.log('сообщение:', todo.message)
    console.log('тек.время:', new Date(currentTime), currentTime)
    console.log('когда напомнить', new Date(dt), dt)
    let waitingTime = dt - currentTime
    let waitInMin = Math.round(waitingTime / (60 * 1000))
    console.log('через сколько минут:', waitInMin)
    console.log('-----------------------')
    if (!todo.repeatable) {
        let remindTimeID = setMinutesTimeout(() => {
            bot.sendMessage(chatId, todo.message);
            deleteTodoJSON(dt);
            remindsQueue = remindsQueue.filter(item => item.name !== todo.message)
        },
            waitInMin
        )
        waitInMin > 0 ? remindsQueue.push({ name: todo.message, ID: remindTimeID }) : null
    } else {
        let remindTimeID = setMinutesTimeout(
            () => {
                bot.sendMessage(chatId, todo.message)
                let otherTodos = getTodosFromJSON().filter(t => t.message !== todo.message)
                todo.datetime = getNextDateRemind(dt, days)
                otherTodos.push(todo)
                writeTodosToJSON(otherTodos)
                setReminderTimeout(chatId, todo, getNextDateRemind(dt, days), days)
            },
            waitInMin
        )
        remindsQueue.push({ name: todo.message, ID: remindTimeID })
    }
}

function setMinutesTimeout(callback, minutes) {
    // 60 seconds in a minute
    let msInMin = 60 * 1000;
    let minCount = 0;
    if (minutes <= 0) { callback.apply(this, []) }
    let timer = setInterval(
        function () {
            minCount++;  // a minutes has passed

            if (minCount == minutes || minutes < 0) {
                clearInterval(timer);
                callback.apply(this, []);
            }
        },
        msInMin
    )
    return timer
}

function getNextDateRemind(UTCdate, days) {
    return UTCdate + days * 24 * 60 * 60 * 1000
}

App()