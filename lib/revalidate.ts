import { revalidatePath } from 'next/cache'

/** Public pages are ISR; any write that changes what they show refreshes all of them. */
export function revalidatePublic() {
  revalidatePath('/', 'layout')
}
