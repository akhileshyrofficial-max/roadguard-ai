
import React from 'react';
import { AlertIcon } from './IconComponents';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg relative mt-6" role="alert">
      <div className="flex">
        <div className="py-1"><AlertIcon className="w-6 h-6 text-red-400 mr-4" /></div>
        <div>
            <strong className="font-bold">An error occurred!</strong>
            <span className="block sm:inline ml-2">{message}</span>
        </div>
      </div>
    </div>
  );
};
