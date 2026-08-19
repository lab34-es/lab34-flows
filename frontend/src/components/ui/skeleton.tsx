import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'> & Record<string, any>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
