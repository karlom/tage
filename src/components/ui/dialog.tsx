import * as React from 'react';


interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

interface DialogContentProps {
    className?: string;
    children: React.ReactNode;
}

interface DialogHeaderProps {
    className?: string;
    children: React.ReactNode;
}

interface DialogFooterProps {
    className?: string;
    children: React.ReactNode;
}

interface DialogTitleProps {
    className?: string;
    children: React.ReactNode;
}

interface DialogDescriptionProps {
    className?: string;
    children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
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

const DialogContent = ({ className = '', children }: DialogContentProps) => {
    return (
        <div className={`relative bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto ${className}`}>
            {children}
        </div>
    );
};

const DialogHeader = ({ className = '', children }: DialogHeaderProps) => {
    return (
        <div className={`flex flex-col space-y-1.5 ${className}`}>
            {children}
        </div>
    );
};

const DialogFooter = ({ className = '', children }: DialogFooterProps) => {
    return (
        <div className={`flex items-center justify-end gap-2 ${className}`}>
            {children}
        </div>
    );
};

const DialogTitle = ({ className = '', children }: DialogTitleProps) => {
    return (
        <h2 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}>
            {children}
        </h2>
    );
};

const DialogDescription = ({ className = '', children }: DialogDescriptionProps) => {
    return (
        <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
            {children}
        </p>
    );
};

export {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
