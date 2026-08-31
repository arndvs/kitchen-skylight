import os from 'node:os'

/** Pure (interfaces injectable) so the ranking is unit-testable on fixtures. */

const VIRTUAL_NAME = /(vEthernet|WSL|Hyper-V|VirtualBox|VMware|vmnet|Tailscale|ZeroTier|Loopback|docker|veth)/i

function isRfc1918(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

/**
 * IPv4 addresses a phone on the home network could plausibly reach, best
 * guess first: real-NIC RFC1918 addresses, then virtual-adapter RFC1918
 * (Hyper-V etc — usually wrong but shown as alternates), then anything else.
 */
export function pickLanAddresses(
  ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()
): string[] {
  const candidates: { ip: string; score: number }[] = []
  for (const [name, infos] of Object.entries(ifaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (info.address.startsWith('169.254.')) continue // link-local = no DHCP, useless
      let score = 0
      if (isRfc1918(info.address)) score += 2
      if (!VIRTUAL_NAME.test(name)) score += 1
      candidates.push({ ip: info.address, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  return [...new Set(candidates.map((c) => c.ip))]
}

/** Addresses in 100.64.0.0/10 are the CGNAT block Tailscale uses for its mesh. */
function isCgnat(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\./.exec(ip)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return a === 100 && b >= 64 && b <= 127
}

/**
 * The Tailscale mesh address for this machine, if the Tailscale adapter is up.
 * Returns the IPv4 CGNAT (100.64.0.0/10) address or null if Tailscale isn't
 * running. Pure and injectable so it's unit-testable on fixtures.
 *
 * Tailscale gives the adapter the OS name "Tailscale" on Windows/macOS; on
 * Linux it's often an interface carrying a 100.x address without the hint, so
 * we also match the CGNAT block directly. The LAN picker deliberately de-ranks
 * these, so this is a separate helper for the "reachable from anywhere" story.
 */
export function pickTailscaleAddress(
  ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()
): string | null {
  const matches: { ip: string; nameHint: boolean }[] = []
  for (const [name, infos] of Object.entries(ifaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (!isCgnat(info.address)) continue
      matches.push({ ip: info.address, nameHint: /tailscale/i.test(name) })
    }
  }
  if (matches.length === 0) return null
  matches.sort((a, b) => Number(b.nameHint) - Number(a.nameHint))
  return matches[0].ip
}
