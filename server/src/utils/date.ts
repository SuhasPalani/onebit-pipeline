import { format, parseISO, isValid } from 'date-fns'

export function formatDate(date: Date | string, formatString = 'yyyy-MM-dd'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatString)
}

export function parseDate(dateString: string): Date {
  const parsed = parseISO(dateString)
  if (!isValid(parsed)) {
    throw new Error(`Invalid date: ${dateString}`)
  }
  return parsed
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6 // Not Sunday (0) or Saturday (6)
}