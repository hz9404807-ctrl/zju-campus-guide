import { useEffect, useState } from 'react'
import { Utensils } from 'lucide-react'
import type { Food } from '../types/food'

/** Shared image and honest missing/error state for public and owner views. */
export function FoodImage({ food, large = false, className = '' }: { food: Pick<Food, 'name' | 'image_url'>; large?: boolean; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  useEffect(() => setFailedUrl(null), [food.image_url])
  const failed = !!food.image_url && failedUrl === food.image_url
  return <div className={`food-image${large ? ' food-image-large' : ''}${className ? ` ${className}` : ''}`}>
    {food.image_url && !failed ? <img
      key={food.image_url}
      src={food.image_url}
      alt={food.name}
      loading={large ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailedUrl(food.image_url)}
    /> : <div className="food-image-placeholder">
      <Utensils size={large ? 42 : 30} aria-hidden="true" />
      <span>{failed ? '图片暂时无法加载' : '暂无图片'}</span>
    </div>}
  </div>
}
