import { Pipe, PipeTransform } from '@angular/core';
import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/**
 * Relative time for notification and activity lists.
 * Usage: `{{ notification.createdAt | timeAgo }}` → "3 hours ago"
 */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = typeof value === 'string' ? parseISO(value) : value;
    if (!isValid(date)) return '';
    return `${formatDistanceToNowStrict(date)} ago`;
  }
}
