import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignalMessage } from '../types/live'

/** Authenticated point-to-point inbox. The database stamps the sender identity.
 * A failed heartbeat closes media; public Realtime broadcasts are never trusted.
 */
export class LiveChannel {
  private stopped = false
  private timer?: ReturnType<typeof setTimeout>
  private receive: (event: {payload: SignalMessage}) => void | Promise<void> = () => {}
  private status: (status: string) => void = () => {}
  constructor(private client: SupabaseClient, private session: string,
    private members: (ids: string[]) => void = () => {}) {}
  on(_type: string, _filter: {event: string}, receive: (event: {payload: SignalMessage}) => void | Promise<void>) {
    this.receive = receive; return this
  }
  subscribe(status: (status: string) => void = () => {}) {
    this.status = status
    // Defer until callers have stored their channel reference.
    queueMicrotask(() => { if (!this.stopped) { status('SUBSCRIBED'); void this.poll() } })
    return this
  }
  async send(event: {type: string; event: string; payload: SignalMessage}) {
    if(this.stopped) return
    try {
      const {error} = await this.client.rpc('live_send_signal', {p_session:this.session,p_payload:event.payload}).abortSignal(AbortSignal.timeout(10000))
      if(error) this.fail()
    } catch { this.fail() }
  }
  close() { this.stopped=true; clearTimeout(this.timer) }
  private fail() { if(this.stopped)return; this.close(); this.status('CLOSED') }
  private async poll() {
    try {
      const {data,error}=await this.client.rpc('live_poll',{p_session:this.session}).abortSignal(AbortSignal.timeout(10000))
      if(this.stopped) return
      if(error || !data || !Array.isArray(data.signals) || !Array.isArray(data.members)) { this.fail(); return }
      this.members(data.members)
      for(const payload of data.signals) {if(this.stopped)return;await this.receive({payload})}
      this.timer=setTimeout(()=>void this.poll(),1000)
    } catch { this.fail() }
  }
}
