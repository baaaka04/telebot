
export function formatDate(unixtime) {
    const jsDate = new Date(unixtime + 3 * 60 * 60 * 1000 )

    const y = jsDate.getUTCFullYear()
    const m = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const d = jsDate.getUTCDate().toString().padStart(2, '0')
    const h = jsDate.getUTCHours().toString().padStart(2, '0')
    const min = jsDate.getUTCMinutes().toString().padStart(2, '0')
    return `${d}-${m}-${y} ${h}:${min}`
}