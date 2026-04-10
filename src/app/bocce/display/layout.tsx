export const metadata = {
  title: 'TV Display | Governors Club Bocce',
  description: 'TV display for current games and standings',
};

export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No navigation or footer - full screen display for TV
  return <>{children}</>;
}
