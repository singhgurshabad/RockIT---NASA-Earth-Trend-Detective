/** The team's RockIT logo: the Earth, facing the Americas. */
export default function Logo({ size = 34 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" width={size} height={size} alt="" aria-hidden="true" style={{ display: "block", filter: "drop-shadow(0 0 6px rgba(90, 169, 255, 0.55))" }} />;
}
