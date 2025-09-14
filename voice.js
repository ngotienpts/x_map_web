// ===== ENHANCED VOICE AUDIO CLASS WITH MUTE CONTROL =====
// Chỉ có 2 function chính: loadAudio(text) và play() + mute control

const VOICE_CONFIG = {
    tts: {
        apiUrl: 'https://voice.ex-cdn.com/tts.php'
    },
    storage: {
        muteKey: 'voiceAudioMuted'
    }
};

class VoiceAudio {
    constructor() {
        this.audio = null;
        this.isReady = false;
        this.isPlaying = false;
        this.isMuted = false;
        
        // Load mute state from localStorage
        this.loadMuteState();
        this.initializeMuteButton();
    }
    
    // ===== MUTE CONTROL =====
    
    loadMuteState() {
        const saved = localStorage.getItem(VOICE_CONFIG.storage.muteKey);
        this.isMuted = saved === 'true';
    }
    
    saveMuteState() {
        localStorage.setItem(VOICE_CONFIG.storage.muteKey, this.isMuted.toString());
        console.log(`🎤 Voice mute state saved: ${this.isMuted ? 'MUTED' : 'UNMUTED'}`);
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.saveMuteState();
        this.updateMuteButton();
        
        // Stop current audio if muting
        if (this.isMuted && this.isPlaying) {
            this.stop();
        }
        
        console.log(`🎤 Voice ${this.isMuted ? 'MUTED' : 'UNMUTED'}`);
        return this.isMuted;
    }
    
    setMuted(muted) {
        this.isMuted = muted;
        this.saveMuteState();
        this.updateMuteButton();
        
        if (this.isMuted && this.isPlaying) {
            this.stop();
        }
        
        console.log(`🎤 Voice set to ${this.isMuted ? 'MUTED' : 'UNMUTED'}`);
    }
    
    initializeMuteButton() {
        // Setup mute button event listener
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            // Remove existing listeners
            muteButton.replaceWith(muteButton.cloneNode(true));
            const newMuteButton = document.getElementById('mute-button');
            
            newMuteButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMute();
            });
            
            // Set initial state
            this.updateMuteButton();
        } else {
            setTimeout(() => {
                this.initializeMuteButton();
            }, 1000);
        }
    }
    
    updateMuteButton() {
        const muteButton = document.getElementById('mute-button');
        if (muteButton) {
            if (this.isMuted) {
                muteButton.classList.add('active');
                muteButton.title = 'Bật âm thanh';
            } else {
                muteButton.classList.remove('active');
                muteButton.title = 'Tắt âm thanh';
            }
        }
    }
    
    // ===== MAIN AUDIO FUNCTIONS =====
    
    // Nạp audio từ text
    async loadAudio(text) {
        try {
            // Cleanup previous audio
            if (this.audio) {
                this.audio.pause();
                this.audio = null;
            }
            
            this.isReady = false;
            this.isPlaying = false;
            
            // Tạo URL
            const encodedText = encodeURIComponent(text);
            const url = `${VOICE_CONFIG.tts.apiUrl}?text=${encodedText}`;
            
            // Tạo và load audio
            this.audio = new Audio(url);
            this.audio.volume = 1.0;
            this.audio.preload = 'auto';
            
            // Đợi load xong
            await new Promise((resolve, reject) => {
                this.audio.oncanplaythrough = () => {
                    this.audio.oncanplaythrough = null;
                    this.isReady = true;
                    resolve();
                };
                
                this.audio.onerror = () => {
                    this.audio.onerror = null;
                    reject(new Error('Audio load failed'));
                };
                
                this.audio.load();
            });
            
            return true;
            
        } catch (error) {
            console.error('🎤 Load audio failed:', error);
            
            // Fallback to browser TTS
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'vi-VN';
                utterance.rate = 1.0;
                utterance.volume = 1.0;
                
                this.audio = { 
                    play: () => speechSynthesis.speak(utterance),
                    pause: () => speechSynthesis.cancel()
                };
                this.isReady = true;
                return true;
            }
            
            return false;
        }
    }
    
    // Phát audio đã load
    async play() {
        // Check mute first
        if (this.isMuted) {
            console.log('🎤 Play skipped (muted)');
            return true; // Return true to not break navigation logic
        }
        
        if (!this.audio || !this.isReady) {
            console.warn('🎤 Audio not ready. Call loadAudio(text) first.');
            return false;
        }
        
        if (this.isPlaying) {
            console.warn('🎤 Audio already playing.');
            return false;
        }
        
        try {
            this.isPlaying = true;
            
            // Set event handlers
            if (this.audio.onended !== undefined) {
                this.audio.onended = () => {
                    this.isPlaying = false;
                };
            }
            
            if (this.audio.onerror !== undefined) {
                this.audio.onerror = () => {
                    this.isPlaying = false;
                };
            }
            
            await this.audio.play();
            return true;
            
        } catch (error) {
            console.error('🎤 Play failed:', error);
            this.isPlaying = false;
            return false;
        }
    }
    
    // ===== HELPERS =====
    
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
        }
        
        // Also stop browser TTS
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
    }
    
    getStatus() {
        return {
            ready: this.isReady,
            playing: this.isPlaying,
            muted: this.isMuted
        };
    }
    
    // Clear audio and reset state
    clear() {
        this.stop();
        this.audio = null;
        this.isReady = false;
        this.isPlaying = false;
    }
}