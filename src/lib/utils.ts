import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // High-quality compression. Limit dimension to 1600px to ensure each image fits well within Firestore 1MB document limit.
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress as JPEG at 80% quality for high resolution (each image gets its own Firestore document)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      
      img.onerror = (error) => reject(error);
      img.src = e.target?.result as string;
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 15);
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};


export const fileToBase64WithGeotag = (file: File, geoText: string, timeText: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Add Geotagging Watermark
        if (geoText || timeText) {
          const fontSize = Math.max(16, Math.floor(width * 0.025));
          ctx.font = `${fontSize}px sans-serif`;
          
          // Background box
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          const padding = fontSize * 0.5;
          
          const text1 = geoText;
          const text2 = timeText;
          
          const metrics1 = ctx.measureText(text1);
          const metrics2 = ctx.measureText(text2);
          const boxWidth = Math.max(metrics1.width, metrics2.width) + padding * 2;
          const boxHeight = (fontSize * 2) + (padding * 3);
          
          // Draw at bottom right
          const x = width - boxWidth - padding;
          const y = height - boxHeight - padding;
          
          ctx.fillRect(x, y, boxWidth, boxHeight);
          
          ctx.fillStyle = 'white';
          ctx.textBaseline = 'top';
          ctx.fillText(text1, x + padding, y + padding);
          ctx.fillText(text2, x + padding, y + padding * 2 + fontSize);
        }
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      
      img.onerror = (error) => reject(error);
      img.src = e.target?.result as string;
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
