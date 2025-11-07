import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	headers() {
		// Adjust security headers to support Base Account SDK (requires COOP not set to 'same-origin')
		return Promise.resolve([
			{
				source: '/:path*',
				headers: [
					{
						key: 'Cross-Origin-Opener-Policy',
						value: 'unsafe-none',
					},
					{
						key: 'Cross-Origin-Embedder-Policy',
						value: 'unsafe-none',
					},
				],
			},
		]);
	},
};

export default nextConfig;
