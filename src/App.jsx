import React, { useState, useEffect } from 'react';
import { FileArchive, CheckCircle, AlertCircle, Copy } from 'lucide-react';

export default function App() {
  const [jsZipLoaded, setJsZipLoaded] = useState(false);
  const [tweetsData, setTweetsData] = useState(null);
  const [metricsData, setMetricsData] = useState(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Load JSZip from CDN
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => setJsZipLoaded(true);
      script.onerror = () => setError('Failed to load JSZip library. Please refresh the page.');
      document.head.appendChild(script);
    } else {
      setJsZipLoaded(true);
    }
  }, []);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = [];
    let current = '';
    let inQuotes = false;
    
    // Parse headers
    for (let j = 0; j < lines[0].length; j++) {
      const char = lines[0][j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        headers.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    headers.push(current.trim().replace(/^"|"$/g, ''));
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = {};
      const values = [];
      current = '';
      inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        const numValue = parseFloat(value);
        row[header] = isNaN(numValue) || value === '' || !/^-?\d+(\.\d+)?$/.test(value) ? value : numValue;
      });
      
      if (Object.keys(row).length > 0) {
        data.push(row);
      }
    }
    return data;
  };

  const identifyCSVType = (headers) => {
    if (headers.includes('Tweet Text') || headers.includes('Tweet Permalink') || headers.includes('Engagements')) {
      return 'tweets';
    }
    if (headers.some(h => h.includes('Followers (Overall aggregated value')) || 
        headers.some(h => h.includes('Net new followers'))) {
      return 'metrics';
    }
    return 'unknown';
  };

  const handleZipUpload = async (file) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setIsDragging(false);
    
    try {
      if (!window.JSZip) {
        setError('JSZip library is still loading. Please wait a moment and try again.');
        setLoading(false);
        return;
      }

      const zip = new window.JSZip();
      const zipContent = await zip.loadAsync(file);
      
      let foundTweets = false;
      let foundMetrics = false;
      
      for (const [filename, zipFile] of Object.entries(zipContent.files)) {
        if (zipFile.dir) continue;
        
        if (filename.endsWith('.csv')) {
          const csvText = await zipFile.async('text');
          const data = parseCSV(csvText);
          
          if (data.length === 0) continue;
          
          const headers = Object.keys(data[0]);
          const csvType = identifyCSVType(headers);
          
          if (csvType === 'tweets') {
            setTweetsData(data);
            foundTweets = true;
          } else if (csvType === 'metrics') {
            setMetricsData(data);
            foundMetrics = true;
          }
        }
      }
      
      if (foundTweets && foundMetrics) {
        setSuccess('Zip file processed successfully! Found both CSV files.');
      } else if (!foundTweets && !foundMetrics) {
        setError('Could not find the expected CSV files in the zip. Please make sure you uploaded the correct Hootsuite export.');
      } else if (!foundTweets) {
        setError('Found metrics CSV but missing tweets CSV in the zip file.');
      } else {
        setError('Found tweets CSV but missing metrics CSV in the zip file.');
      }
      
    } catch (err) {
      setError(`Error processing zip file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging && jsZipLoaded && !loading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.zip')) {
        handleZipUpload(file);
      } else {
        setError('Please upload a .zip file');
      }
    }
  };

  const formatNumber = (num) => {
    const n = parseFloat(num);
    if (isNaN(n)) return '0';
    if (n >= 1000000) {
      return (Math.floor(n / 100000) / 10).toFixed(1) + 'M';
    } else if (n >= 1000) {
      return (Math.floor(n / 100) / 10).toFixed(1) + 'K';
    }
    return n.toString();
  };

  const generateReport = () => {
    try {
      if (!tweetsData || !metricsData) {
        setError('Please upload the zip file first');
        return;
      }

      const sortedTweets = [...tweetsData].sort((a, b) => 
        parseFloat(b.Engagements || 0) - parseFloat(a.Engagements || 0)
      );
      
      const top3 = sortedTweets.slice(0, 3);
      
      let totalFollowers = 0;
      let netNewFollowers = 0;
      let totalImpressions = 0;
      let totalMentions = 0;
      
      metricsData.forEach((row, index) => {
        // Find the correct column names dynamically
        const followersKey = Object.keys(row).find(k => k.includes('Followers (Overall aggregated value'));
        const newFollowersKey = Object.keys(row).find(k => k.includes('Net new followers'));
        const impressionsKey = Object.keys(row).find(k => k.includes('Post impressions'));
        const mentionsKey = Object.keys(row).find(k => k.includes('Mentions'));
        
        const followers = parseFloat(row[followersKey] || 0);
        const newFollowers = parseFloat(row[newFollowersKey] || 0);
        const impressions = parseFloat(row[impressionsKey] || 0);
        const mentions = parseFloat(row[mentionsKey] || 0);
        
        if (index === metricsData.length - 1) {
          totalFollowers = followers;
        }
        netNewFollowers += newFollowers;
        totalImpressions += impressions;
        totalMentions += mentions;
      });
      
      let reportText = `Last week, the @SecVetAffairs X account gained ${Math.round(netNewFollowers)} new followers, bringing your total followers to nearly ${(Math.floor(totalFollowers / 100) / 10).toFixed(1)}K. `;
      reportText += `Your X handle was mentioned more than ${formatNumber(totalMentions)} times and your posts had more than ${formatNumber(totalImpressions)} total impressions. `;
      reportText += `Here is a breakdown of your top three performing posts and associated metrics:\n\n`;
      
      top3.forEach((tweet, index) => {
        const tweetText = (tweet['Tweet Text'] || '').replace(/https?:\/\/[^\s]+/g, '').trim();
        const tweetLink = tweet['Tweet Permalink'] || '';
        const retweets = formatNumber(tweet.Retweets || 0);
        const engagements = formatNumber(tweet.Engagements || 0);
        const impressions = formatNumber(tweet.Impressions || 0);
        const likes = formatNumber(tweet.Likes || 0);
        
        reportText += `**@SecVetAffairs X post:** "${tweetText}"\n`;
        reportText += `Link: ${tweetLink}\n`;
        reportText += `- Over ${retweets} retweets\n`;
        reportText += `- Over ${engagements} engagements\n`;
        reportText += `- Over ${impressions} impressions\n`;
        reportText += `- Over ${likes} likes\n`;
        
        if (index < 2) reportText += '\n';
      });
      
      setReport(reportText);
      setSuccess('Report generated successfully!');
      setError('');
    } catch (err) {
      setError(`Error generating report: ${err.message}`);
    }
  };

  const copyToClipboard = async () => {
    try {
      const tempDiv = document.createElement('div');
      let htmlContent = report
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/Link: (https:\/\/[^\n]+)/g, 'Link: <a href="$1" target="_blank">$1</a>')
        .replace(/\n/g, '<br>');
      
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      document.execCommand('copy');
      
      selection.removeAllRanges();
      document.body.removeChild(tempDiv);
      
      setSuccess('Report copied to clipboard with formatting!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      try {
        await navigator.clipboard.writeText(report);
        setSuccess('Report copied to clipboard (plain text)!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (fallbackErr) {
        setError('Failed to copy to clipboard');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold text-blue-900 mb-8 border-b-4 border-blue-700 pb-3">
          📊 Weekly Report Generator
        </h1>
        
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <FileArchive className="w-6 h-6 mr-2" />
            Upload Your Hootsuite Export
          </h2>
          <p className="text-gray-600 mb-6">Upload the zip file exported from Hootsuite Analytics containing both CSV files:</p>
          
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isDragging 
                ? 'border-blue-500 bg-blue-100' 
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
            } ${loading || !jsZipLoaded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="file"
              accept=".zip"
              onChange={(e) => e.target.files[0] && handleZipUpload(e.target.files[0])}
              disabled={loading || !jsZipLoaded}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            
            <div className="pointer-events-none">
              <FileArchive className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="text-lg font-semibold text-gray-700 mb-2">
                {isDragging ? 'Drop your zip file here' : 'Drag & drop your zip file here'}
              </p>
              <p className="text-sm text-gray-500 mb-4">or click to browse</p>
              <p className="text-xs text-gray-400">Accepts .zip files from Hootsuite Analytics</p>
            </div>
          </div>
          
          <div className="mt-4">
            {!jsZipLoaded && (
              <p className="text-sm text-gray-600 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Loading zip file processor...
              </p>
            )}
            
            {loading && (
              <p className="text-sm text-blue-600 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Processing zip file...
              </p>
            )}
            
            {tweetsData && metricsData && (
              <div className="space-y-1">
                <p className="text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Tweets CSV loaded ({tweetsData.length} tweets)
                </p>
                <p className="text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Metrics CSV loaded ({metricsData.length} days)
                </p>
              </div>
            )}
          </div>
          
          <button
            onClick={generateReport}
            disabled={!tweetsData || !metricsData || loading}
            className={`mt-6 px-8 py-3 rounded-md font-semibold text-white transition-colors ${
              tweetsData && metricsData && !loading
                ? 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Generate Report
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
        
        {report && (
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Generated Report</h2>
              <button
                onClick={copyToClipboard}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </button>
            </div>
            <div 
              className="whitespace-pre-wrap text-sm bg-white p-4 rounded border border-gray-200"
              dangerouslySetInnerHTML={{ 
                __html: report
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/Link: (https:\/\/[^\n]+)/g, 'Link: <a href="$1" target="_blank" class="text-blue-600 hover:underline">$1</a>')
                  .replace(/\n/g, '<br>') 
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
