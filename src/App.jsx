import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plane, MapPin, Calendar, MessageCircle, Send, X, Sparkles, AlertCircle, Loader2, DollarSign, Users, Briefcase, Clock, ChevronDown, ChevronUp, Sun, Moon, Camera, UtensilsCrossed, Bus, Hotel, ShoppingBag, AlertTriangle, Heart, Star, Utensils, Package, Phone, Building, Car, Train, Bike, TrendingUp, Download, Share2, Clipboard, Check } from 'lucide-react';

export default function EnhancedTravelPlanner() {
    const [sourceCity, setSourceCity] = useState('');
    const [destination, setDestination] = useState('');
    const [budget, setBudget] = useState('');
    const [duration, setDuration] = useState('');
    const [startDate, setStartDate] = useState('');
    const [travelers, setTravelers] = useState('1');
    const [preferences, setPreferences] = useState('');
    const [transportType, setTransportType] = useState('mixed');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [itineraryGenerated, setItineraryGenerated] = useState(false);
    const [expandedDay, setExpandedDay] = useState(1);
    const [days, setDays] = useState([]);
    const [budgetBreakdown, setBudgetBreakdown] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [logistics, setLogistics] = useState(null);
    const [isCopied, setIsCopied] = useState(false); // New state for copy feedback

    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // FIX: Use empty string for API Key to allow Canvas environment to handle injection
    const apiKey = "AIzaSyD-5uxTsRs64guINkK01iMvq9MwnZupDZE"; 
    const modelName = "gemini-2.5-flash-preview-09-2025";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a world-class travel planner. Generate a comprehensive travel plan in JSON format.
    
Return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, no extra text):
{
  "days": [
    {
      "dayNumber": 1,
      "title": "Arrival & City Orientation",
      "morning": "Check into hotel and explore nearby area",
      "afternoon": "Visit main landmark", 
      "evening": "Try local cuisine",
      "keyActivities": ["Hotel check-in", "City walking tour", "Landmark visit"],
      "estimatedCost": 150,
      "transport": "Walking and metro",
      "accommodation": "City Center Hotel",
      "meals": {
        "breakfast": "Hotel breakfast",
        "lunch": "Local cafe",
        "dinner": "Traditional restaurant"
      }
    }
  ],
  "budgetBreakdown": {
    "total": 3000,
    "accommodation": { "amount": 1200, "percentage": 40 },
    "food": { "amount": 450, "percentage": 15 },
    "transportation": { "amount": 600, "percentage": 20 },
    "activities": { "amount": 450, "percentage": 15 },
    "shopping": { "amount": 150, "percentage": 5 },
    "emergency": { "amount": 150, "percentage": 5 }
  },
  "recommendations": {
    "mustVisit": ["Landmark 1", "Landmark 2", "Landmark 3"],
    "localFood": ["Dish 1", "Dish 2", "Dish 3"],
    "hiddenGems": ["Hidden spot 1", "Hidden spot 2"]
  },
  "logistics": {
    "suggestedStays": [
      { "name": "Budget Hotel", "type": "Budget", "location": "Downtown", "price": 80 },
      { "name": "Comfort Hotel", "type": "Mid-range", "location": "City Center", "price": 150 }
    ],
    "diningOptions": [
      { "name": "Local Bistro", "cuisine": "Local", "specialty": "Traditional dishes", "price": 2 },
      { "name": "Fine Dining", "cuisine": "International", "specialty": "Fusion cuisine", "price": 3 }
    ],
    "packingList": ["Passport", "Comfortable shoes", "Weather appropriate clothing", "Chargers", "First aid"],
    "emergency": {
      "embassy": "Check local embassy website for contact",
      "police": "911 or local emergency number",
      "hospitals": ["City General Hospital", "International Medical Center"]
    }
  }
}`;

    const chatSystemPrompt = `You are a helpful, friendly travel assistant. Answer questions about travel planning, destinations, and provide helpful tips. Keep responses concise (2-3 sentences) and friendly.`;

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const fetchWithBackoff = useCallback(async (url, options, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok || response.status !== 429) return response;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        throw new Error('Request failed after retries');
    }, []);

    const generateItinerary = async () => {
        if (!destination.trim() || !duration || parseInt(duration) < 1) {
            setError('Please enter a destination and duration (minimum 1 day).');
            return;
        }
        setError('');
        setLoading(true);
        setItineraryGenerated(false);

        const transportPrefs = {
            'flight': 'Prefer flights for transportation',
            'train': 'Prefer train travel',
            'bus': 'Prefer bus travel',
            'car': 'Prefer car/driving',
            'mixed': 'Use mix of efficient transport'
        };

        let userQuery = `Create a detailed ${duration}-day travel itinerary for ${destination}.`;
        if (sourceCity) userQuery += ` Starting from ${sourceCity}.`;
        if (budget) userQuery += ` Total budget: $${budget} USD.`;
        if (travelers) userQuery += ` For ${travelers} traveler(s).`;
        if (startDate) userQuery += ` Starting ${startDate}.`;
        userQuery += ` Transport: ${transportPrefs[transportType]}.`;
        if (preferences) userQuery += ` Preferences: ${preferences}.`;
        userQuery += ' Return ONLY the JSON object, no markdown formatting.';

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            tools: [{ google_search: {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.error) {
                setError(`API Error: ${result.error.message || 'Unknown error'}`);
                return;
            }

            const candidate = result.candidates?.[0];
            if (!candidate?.content?.parts?.[0]?.text) {
                setError('No response from AI. Please try again.');
                return;
            }

            let text = candidate.content.parts[0].text.trim();
            text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                text = jsonMatch[0];
            }

            const data = JSON.parse(text);
            
            if (!data.days || !Array.isArray(data.days)) {
                throw new Error('Invalid data structure');
            }

            setDays(data.days);
            setBudgetBreakdown(data.budgetBreakdown || null);
            setRecommendations(data.recommendations || null);
            setLogistics(data.logistics || null);
            setItineraryGenerated(true);
            setExpandedDay(1);

        } catch (err) {
            console.error('Error:', err);
            setError(`Failed to generate itinerary: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return;
        
        const userMessage = chatInput.trim();
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatInput('');
        setChatLoading(true);

        let contextInfo = '';
        if (itineraryGenerated && destination) {
            contextInfo = ` [Trip context: ${destination}, ${duration} days, $${budget || 'flexible'} budget]`;
        }

        const chatPayload = {
            contents: [{ parts: [{ text: userMessage + contextInfo }] }],
            systemInstruction: { parts: [{ text: chatSystemPrompt }] },
        };

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatPayload)
            });
            
            const result = await response.json();

            if (result.error) {
                throw new Error(result.error.message);
            }

            const candidate = result.candidates?.[0];
            const aiResponse = candidate?.content?.parts?.[0]?.text || "I'm having trouble responding. Please try again.";
            
            setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

        } catch (err) {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: "Sorry, I encountered an error. Please try again." 
            }]);
        } finally {
            setChatLoading(false);
        }
    };

    const toggleDay = (dayNum) => {
        setExpandedDay(expandedDay === dayNum ? null : dayNum);
    };

    const exportItinerary = () => {
        const text = `TRAVEL ITINERARY - ${destination}\n\n${days.map(d => 
            `DAY ${d.dayNumber}: ${d.title}\nMorning: ${d.morning}\nAfternoon: ${d.afternoon}\nEvening: ${d.evening}\nKey Activities: ${d.keyActivities?.join(', ')}\nTransport: ${d.transport}\nCost: $${d.estimatedCost}\n`
        ).join('\n')}\n\n--- Budget Breakdown ---\n${budgetBreakdown ? 
            Object.entries(budgetBreakdown).map(([key, item]) => 
                key === 'total' ? `Total Budget: $${item}` : 
                `${key.charAt(0).toUpperCase() + key.slice(1)}: $${item.amount} (${item.percentage}%)`
            ).join('\n') : 'Budget Breakdown not available.'}\n`;
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${destination.replace(/\s+/g, '_')}_itinerary.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyItinerary = () => {
        const budgetText = budgetBreakdown ? 
            Object.entries(budgetBreakdown).map(([key, item]) => 
                key === 'total' ? `Total Budget: $${item}` : 
                `${key.charAt(0).toUpperCase() + key.slice(1)}: $${item.amount} (${item.percentage}%)`
            ).join('\n') : 'Budget Breakdown not available.';

        const text = `TRAVEL ITINERARY - ${destination}\n\n${days.map(d => 
            `DAY ${d.dayNumber}: ${d.title}\nMorning: ${d.morning}\nAfternoon: ${d.afternoon}\nEvening: ${d.evening}\nKey Activities: ${d.keyActivities?.join(', ')}\nTransport: ${d.transport}\nCost: $${d.estimatedCost}\n`
        ).join('\n')}\n\n--- Budget Breakdown ---\n${budgetText}\n`;
        
        // Use document.execCommand('copy') as navigator.clipboard may not work in iFrame
        const tempElement = document.createElement('textarea');
        tempElement.value = text;
        document.body.appendChild(tempElement);
        tempElement.select();
        document.execCommand('copy');
        document.body.removeChild(tempElement);
        
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const transportOptions = [
        { value: 'mixed', label: 'Mixed', icon: Sparkles },
        { value: 'flight', label: 'Flight', icon: Plane },
        { value: 'train', label: 'Train', icon: Train },
        { value: 'bus', label: 'Bus', icon: Bus },
        { value: 'car', label: 'Car', icon: Car }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>

            <header className="relative z-10 bg-gradient-to-r from-purple-800/30 to-blue-800/30 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl">
                                <Plane className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">TravelAI Pro</h1>
                                <p className="text-sm text-purple-200">Smart Travel Planning</p>
                            </div>
                        </div>
                        {itineraryGenerated && (
                            <div className="flex space-x-3">
                                {/* Copy Button */}
                                <button
                                    onClick={copyItinerary}
                                    className={`bg-white/10 ${isCopied ? 'bg-green-500/50' : 'hover:bg-white/20'} text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2`}
                                >
                                    {isCopied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span className="hidden sm:inline">Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clipboard className="w-4 h-4" />
                                            <span className="hidden sm:inline">Copy</span>
                                        </>
                                    )}
                                </button>
                                {/* Export Button */}
                                <button
                                    onClick={exportItinerary}
                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!itineraryGenerated ? (
                    <>
                        <div className="text-center mb-12">
                            <h2 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-blue-200 mb-4">
                                Plan Your Dream Journey
                            </h2>
                            <p className="text-xl text-purple-200">Intelligent travel planning in seconds</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 mb-8 shadow-2xl max-w-5xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center text-sm font-medium text-purple-200 mb-2">
                                        <MapPin className="w-4 h-4 mr-2" />
                                        Source City
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., New York"
                                        value={sourceCity}
                                        onChange={(e) => setSourceCity(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-medium text-pink-200 mb-2">
                                        <MapPin className="w-4 h-4 mr-2" />
                                        Destination *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Paris"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-medium text-green-200 mb-2">
                                        <DollarSign className="w-4 h-4 mr-2" />
                                        Budget (USD)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g., 3000"
                                        value={budget}
                                        onChange={(e) => setBudget(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-medium text-yellow-200 mb-2">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Duration (Days) *
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g., 7"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        min="1"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-medium text-blue-200 mb-2">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-medium text-orange-200 mb-2">
                                        <Users className="w-4 h-4 mr-2" />
                                        Travelers
                                    </label>
                                    <input
                                        type="number"
                                        value={travelers}
                                        onChange={(e) => setTravelers(e.target.value)}
                                        min="1"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="flex items-center text-sm font-medium text-cyan-200 mb-3">
                                        <Bus className="w-4 h-4 mr-2" />
                                        Preferred Transportation
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {transportOptions.map(({ value, label, icon: Icon }) => (
                                            <button
                                                key={value}
                                                onClick={() => setTransportType(value)}
                                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                                                    transportType === value
                                                        ? 'bg-cyan-500/30 border-cyan-400 text-white'
                                                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                                }`}
                                            >
                                                <Icon className="w-6 h-6" />
                                                <span className="text-sm font-medium">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="flex items-center text-sm font-medium text-indigo-200 mb-2">
                                        <Briefcase className="w-4 h-4 mr-2" />
                                        Travel Preferences
                                    </label>
                                    <textarea
                                        placeholder="e.g., Love museums, vegetarian food, avoid crowds..."
                                        value={preferences}
                                        onChange={(e) => setPreferences(e.target.value)}
                                        rows="3"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg flex items-center text-red-200">
                                    <AlertCircle className="w-5 h-5 mr-2" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            <button
                                onClick={generateItinerary}
                                disabled={loading}
                                className="mt-6 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center space-x-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-6 h-6" />
                                        <span>Generate Itinerary</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center">
                                    <Calendar className="w-8 h-8 mr-3 text-pink-300" />
                                    Daily Itinerary
                                </h2>
                                
                                <div className="space-y-4">
                                    {days.map((day) => (
                                        <div key={day.dayNumber} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                            <button
                                                onClick={() => toggleDay(day.dayNumber)}
                                                className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-all"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                                                        {day.dayNumber}
                                                    </div>
                                                    <span className="text-xl font-semibold text-white">{day.title}</span>
                                                </div>
                                                {expandedDay === day.dayNumber ? (
                                                    <ChevronUp className="w-6 h-6 text-purple-300" />
                                                ) : (
                                                    <ChevronDown className="w-6 h-6 text-purple-300" />
                                                )}
                                            </button>

                                            {expandedDay === day.dayNumber && (
                                                <div className="p-6 space-y-4 border-t border-white/10">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 p-4 rounded-xl border border-orange-400/30">
                                                            <div className="flex items-center mb-2">
                                                                <Sun className="w-5 h-5 text-yellow-300 mr-2" />
                                                                <span className="font-semibold text-yellow-200">Morning</span>
                                                            </div>
                                                            <p className="text-sm text-white/90">{day.morning}</p>
                                                        </div>

                                                        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-4 rounded-xl border border-blue-400/30">
                                                            <div className="flex items-center mb-2">
                                                                <Sun className="w-5 h-5 text-cyan-300 mr-2" />
                                                                <span className="font-semibold text-cyan-200">Afternoon</span>
                                                            </div>
                                                            <p className="text-sm text-white/90">{day.afternoon}</p>
                                                        </div>

                                                        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 rounded-xl border border-purple-400/30">
                                                            <div className="flex items-center mb-2">
                                                                <Moon className="w-5 h-5 text-pink-300 mr-2" />
                                                                <span className="font-semibold text-pink-200">Evening</span>
                                                            </div>
                                                            <p className="text-sm text-white/90">{day.evening}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                                        <div className="flex items-center mb-3">
                                                            <Camera className="w-5 h-5 text-purple-300 mr-2" />
                                                            <span className="font-semibold text-purple-200">Key Activities</span>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {day.keyActivities?.map((activity, idx) => (
                                                                <li key={idx} className="text-sm text-white/90 flex items-start">
                                                                    <span className="text-pink-400 mr-2">{"\u2022"}</span>
                                                                    {activity}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-4 rounded-xl border border-green-400/30">
                                                            <div className="text-sm text-white/90 space-y-1">
                                                                <p><strong>Cost:</strong> ${day.estimatedCost}</p>
                                                                <p><strong>Transport:</strong> {day.transport}</p>
                                                                <p><strong>Stay:</strong> {day.accommodation}</p>
                                                            </div>
                                                        </div>

                                                        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 p-4 rounded-xl border border-yellow-400/30">
                                                            <div className="text-xs text-white/90 space-y-1">
                                                                <p><strong>B:</strong> {day.meals?.breakfast}</p>
                                                                <p><strong>L:</strong> {day.meals?.lunch}</p>
                                                                <p><strong>D:</strong> {day.meals?.dinner}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {logistics && (
                                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                                        <Briefcase className="w-6 h-6 mr-2 text-orange-300" />
                                        Logistics & Safety
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <h3 className="font-semibold text-blue-200 mb-2 flex items-center text-sm">
                                                <Hotel className="w-4 h-4 mr-1" />
                                                Stays
                                            </h3>
                                            {logistics.suggestedStays?.map((h, i) => (
                                                <div key={i} className="text-xs text-white/80 mb-2">
                                                    <p className="font-semibold">{h.name}</p>
                                                    <p>{h.location} - ${h.price}/night</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <h3 className="font-semibold text-yellow-200 mb-2 flex items-center text-sm">
                                                <Utensils className="w-4 h-4 mr-1" />
                                                Dining
                                            </h3>
                                            {logistics.diningOptions?.map((r, i) => (
                                                <div key={i} className="text-xs text-white/80 mb-2">
                                                    <p className="font-semibold">{r.name}</p>
                                                    {/* FIX: Correctly render price level by repeating '$' character */}
                                                    <p>{r.cuisine} - {'$'.repeat(r.price)}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <h3 className="font-semibold text-purple-200 mb-2 flex items-center text-sm">
                                                <Package className="w-4 h-4 mr-1" />
                                                Packing
                                            </h3>
                                            <ul className="text-xs text-white/80 space-y-1">
                                                {logistics.packingList?.slice(0, 5).map((item, i) => (
                                                    <li key={i}>{"\u2022"} {item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="bg-red-500/20 p-4 rounded-xl border border-red-400/30">
                                        <h3 className="font-semibold text-red-200 mb-2 flex items-center text-sm">
                                            <AlertTriangle className="w-4 h-4 mr-1" />
                                            Emergency
                                        </h3>
                                        <div className="grid grid-cols-3 gap-2 text-xs text-white/80">
                                            <div>
                                                <p className="font-semibold">Embassy</p>
                                                <p>{logistics.emergency?.embassy}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold">Police</p>
                                                <p>{logistics.emergency?.police}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold">Hospitals</p>
                                                {logistics.emergency?.hospitals?.slice(0, 2).map((h, i) => (
                                                    <p key={i}>{h}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-1 space-y-6">
                            {budgetBreakdown && (
                                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl sticky top-6">
                                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                                        <TrendingUp className="w-6 h-6 mr-2 text-green-300" />
                                        Budget
                                    </h3>
                                    
                                    <div className="mb-6">
                                        <p className="text-sm text-white/70">Total Planned Budget</p>
                                        <p className="text-4xl font-bold text-green-300">${budgetBreakdown.total}</p>
                                    </div>

                                    <div className="space-y-3">
                                        {[
                                            { key: 'accommodation', label: 'Accommodation', icon: Hotel, color: 'bg-blue-500' },
                                            { key: 'food', label: 'Food', icon: UtensilsCrossed, color: 'bg-yellow-500' },
                                            { key: 'transportation', label: 'Transport', icon: Bus, color: 'bg-orange-500' },
                                            { key: 'activities', label: 'Activities', icon: Camera, color: 'bg-pink-500' },
                                            { key: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'bg-purple-500' },
                                            { key: 'emergency', label: 'Emergency', icon: AlertTriangle, color: 'bg-red-500' }
                                        ].map(({ key, label, icon: Icon, color }) => {
                                            const item = budgetBreakdown[key];
                                            if (!item) return null;
                                            return (
                                                <div key={key} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <Icon className="w-4 h-4 mr-2 text-white/80" />
                                                            <span className="text-sm text-white/90">{label}</span>
                                                        </div>
                                                        <span className="text-sm font-semibold text-white">
                                                            ${item.amount} ({item.percentage}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${color} rounded-full transition-all duration-500`}
                                                            style={{ width: `${item.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {recommendations && (
                                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
                                    <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                                        <Star className="w-6 h-6 mr-2 text-yellow-300" />
                                        Recommendations
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center mb-2">
                                                <MapPin className="w-4 h-4 mr-2 text-blue-300" />
                                                <span className="font-semibold text-blue-200 text-sm">Must Visit</span>
                                            </div>
                                            <p className="text-sm text-white/90">{recommendations.mustVisit?.join(', ')}</p>
                                        </div>

                                        <div>
                                            <div className="flex items-center mb-2">
                                                <UtensilsCrossed className="w-4 h-4 mr-2 text-yellow-300" />
                                                <span className="font-semibold text-yellow-200 text-sm">Local Food</span>
                                            </div>
                                            <p className="text-sm text-white/90">{recommendations.localFood?.join(', ')}</p>
                                        </div>

                                        <div>
                                            <div className="flex items-center mb-2">
                                                <Heart className="w-4 h-4 mr-2 text-pink-300" />
                                                <span className="font-semibold text-pink-200 text-sm">Hidden Gems</span>
                                            </div>
                                            <p className="text-sm text-white/90">{recommendations.hiddenGems?.join(', ')}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setItineraryGenerated(false);
                                    setDays([]);
                                    setBudgetBreakdown(null);
                                    setRecommendations(null);
                                    setLogistics(null);
                                }}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center space-x-2"
                            >
                                <Sparkles className="w-5 h-5" />
                                <span>Plan New Trip</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`fixed bottom-8 right-8 p-5 rounded-full shadow-2xl text-white transition-all duration-300 z-50 transform hover:scale-110 ${
                    chatOpen ? 'bg-gradient-to-r from-red-500 to-pink-500' : 'bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse'
                }`}
            >
                {chatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>

            {chatOpen && (
                <div className="fixed bottom-28 right-8 w-96 h-[500px] bg-white/95 backdrop-blur-xl border border-purple-200 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <MessageCircle className="w-5 h-5" />
                            <h3 className="font-bold">AI Travel Assistant</h3>
                        </div>
                        <button onClick={() => setChatOpen(false)} className="hover:bg-white/20 p-1 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50/50 to-white">
                        {chatMessages.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm font-semibold mb-2">👋 Hi! I'm your AI Travel Assistant</p>
                                <p className="text-xs text-gray-400 px-4">Ask me about destinations, tips, or travel advice!</p>
                                
                                <div className="mt-4 space-y-2 px-2">
                                    <button
                                        onClick={() => setChatInput("What are the best times to visit Paris?")}
                                        className="w-full text-left p-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-xs text-gray-700 transition-all"
                                    >
                                        ✈️ Best times to visit Paris?
                                    </button>
                                    <button
                                        onClick={() => setChatInput("Give me budget travel tips")}
                                        className="w-full text-left p-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-xs text-gray-700 transition-all"
                                    >
                                        💰 Budget travel tips
                                    </button>
                                    <button
                                        onClick={() => setChatInput("What should I pack for Europe?")}
                                        className="w-full text-left p-2 bg-purple-100 hover:bg-purple-200 rounded-lg text-xs text-gray-700 transition-all"
                                    >
                                        🎒 Packing tips for Europe
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {chatMessages.map((message, index) => (
                                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-md ${
                                            message.role === 'user'
                                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-none'
                                                : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                                        }`}>
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-md flex items-center space-x-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                            <span className="text-sm text-gray-600">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                                placeholder="Ask me anything..."
                                className="flex-1 px-4 py-2 bg-gray-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                disabled={chatLoading}
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 shadow-md disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                /* Font from Tailwind CDN */
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                }
                
                @keyframes blob {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }

                /* Ensure date input looks good on mobile/dark mode */
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    opacity: 0.7;
                }
            `}</style>
        </div>
    );
}