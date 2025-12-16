import * as React from 'react';

interface AlertDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

interface AlertDialogContentProps {
    className?: string;
    children: React.ReactNode;
}

interface AlertDialogHeaderProps {
    className?: string;
    children: React.ReactNode;
}

interface AlertDialogFooterProps {
    className?: string;
    children: React.ReactNode;
}

interface AlertDialogTitleProps {
    className?: string;
    children: React.ReactNode;
}

interface AlertDialogDescriptionProps {
    className?: string;
    children: React.ReactNode;
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => onOpenChange?.(false)}
        >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative z-50" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};

const AlertDialogContent = ({ className = '', children }: AlertDialogContentProps) => {
    return (
        <div className={`relative bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 w-full max-w-md ${className}`}>
            {children}
        </div>
    );
};

const AlertDialogHeader = ({ className = '', children }: AlertDialogHeaderProps) => {
    return (
        <div className={`flex flex-col space-y-1.5 mb-4 ${className}`}>
            {children}
        </div>
    );
};

const AlertDialogFooter = ({ className = '', children }: AlertDialogFooterProps) => {
    return (
        <div className={`flex items-center justify-end gap-2 mt-4 ${className}`}>
            {children}
        </div>
    );
};

const AlertDialogTitle = ({ className = '', children }: AlertDialogTitleProps) => {
    return (
        <h2 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}>
            {children}
        </h2>
    );
};

const AlertDialogDescription = ({ className = '', children }: AlertDialogDescriptionProps) => {
    return (
        <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
            {children}
        </p>
    );
};

const AlertDialogAction = ({ className = '', children, ...props }: AlertDialogActionProps) => {
    return (
        <button
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

const AlertDialogCancel = ({ className = '', children, ...props }: AlertDialogCancelProps) => {
    return (
        <button
            className={`px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
};
