'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  content: string;
  imageUrls?: string[];
  likeCount: number;
  commentCount: number;
  timestamp: Date;
}

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const { token } = useAuthStore();

  useEffect(() => {
    fetchFeed();
  }, [token]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/feed/me?offset=${offset}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setPosts([...posts, ...response.data.posts]);
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    setOffset(offset + 20);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <img
                src={post.userImage}
                alt={post.userName}
                className="w-12 h-12 rounded-full mr-4"
              />
              <div>
                <h3 className="font-bold">{post.userName}</h3>
                <p className="text-gray-500 text-sm">
                  {new Date(post.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="mb-4">{post.content}</p>
            {post.imageUrls && post.imageUrls.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {post.imageUrls.map((url, idx) => (
                  <img key={idx} src={url} alt="Post" className="rounded" />
                ))}
              </div>
            )}
            <div className="flex gap-6 text-gray-500 text-sm">
              <span>❤️ {post.likeCount} Likes</span>
              <span>💬 {post.commentCount} Comments</span>
            </div>
          </div>
        ))}
      </div>
      {!loading && (
        <button
          onClick={handleLoadMore}
          className="w-full mt-8 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          Load More
        </button>
      )}
    </div>
  );
}
