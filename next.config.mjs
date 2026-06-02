import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  reactStrictMode: true,
  typedRoutes: false,
  // Allow building to a dir outside the project. On Windows + OneDrive, the
  // default `.next` gets locked/moved by sync mid-build, causing intermittent
  // ENOENT/PageNotFound errors. Set NEXT_DIST_DIR to a non-synced path to build
  // cleanly locally. Vercel (Linux) is unaffected and uses the default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [[rehypeKatex, { strict: false }]],
  },
});

export default withMDX(nextConfig);
