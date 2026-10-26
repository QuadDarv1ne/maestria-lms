import { env } from "@/lib/env";

interface ArticleJsonLdProps {
  article: {
    title: string;
    slug: string;
    excerpt: string | null;
    image: string | null;
    category: string;
    createdAt: string;
    updatedAt: string;
    readTime: number;
    authorName: string | null;
  };
}

/**
 * JSON-LD structured data for the article page.
 *
 * Provides both `Article` and `BreadcrumbList` schemas so search engines can
 * display rich snippets and understand the site hierarchy.
 */
export function ArticleJsonLd({ article }: ArticleJsonLdProps) {
  const url = `${env.siteUrl}/blog/${article.slug}`;
  const imageUrl = article.image
    ? article.image.startsWith("http")
      ? article.image
      : `${env.siteUrl}${article.image}`
    : undefined;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": url,
        headline: article.title,
        description: article.excerpt ?? undefined,
        image: imageUrl ? [imageUrl] : undefined,
        datePublished: article.createdAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        wordCount: undefined,
        timeRequired: `PT${article.readTime}M`,
        articleSection: article.category,
        author: {
          "@type": "Person",
          name: article.authorName ?? "Maestria",
        },
        publisher: {
          "@type": "Organization",
          name: "Maestria",
          url: env.siteUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: env.siteUrl },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${env.siteUrl}/blog` },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
