import { parsePhoneNumberFromString } from 'libphonenumber-js'

export const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatPhone(p) {
  const n = p ? parsePhoneNumberFromString(p) : null
  return n ? n.formatInternational() : p || '—'
}

export function whatsappUrl(r) {
  const phone = (r.customer_phone || '').replace(/\D/g, '')
  const msg = r.days_left < 0
    ? `Hola ${r.customer_name}, tu ${r.product_name} venció el ${r.end_date}. ¿Deseas renovar? Si no, se cortará el acceso.`
    : `Hola ${r.customer_name}, tu ${r.product_name} vence el ${r.end_date}. ¿Te lo renuevo?`
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

export const trashReasons = [
  { value: 'down', label: 'Se cayó' },
  { value: 'changed', label: 'Se cambió' },
  { value: 'stolen', label: 'Se la robaron' },
  { value: 'other', label: 'Otro motivo' },
]

export const reasonLabel = (v) => trashReasons.find((r) => r.value === v)?.label || '—'

export function daysChip(d) {
  const n = Number(d)
  if (n < 0) return { text: `Vencida hace ${-n} ${-n === 1 ? 'día' : 'días'}`, cls: 'bg-rose-100 text-rose-700' }
  if (n === 0) return { text: 'Vence hoy', cls: 'bg-rose-100 text-rose-700' }
  if (n <= 3) return { text: `${n} ${n === 1 ? 'día' : 'días'}`, cls: 'bg-amber-100 text-amber-800' }
  return { text: `${n} días`, cls: 'bg-emerald-100 text-emerald-700' }
}