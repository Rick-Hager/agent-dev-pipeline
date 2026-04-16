import CartProvider from "@/components/CartProvider";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  return <CartProvider slug={slug}>{children}</CartProvider>;
}
