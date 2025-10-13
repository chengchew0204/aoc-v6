# Debug Guide - Video & Follow-up Issues

## 🔧 Latest Fixes Applied

### Fix 1: Video Streaming (Event-Based Approach)

**Changed:** From setTimeout polling to event listeners

**Before:**
```typescript
await room.localParticipant.setCameraEnabled(true);
setTimeout(() => {
  // Try to attach track
}, 1000);
```

**After:**
```typescript
room.localParticipant.on('localTrackPublished', (publication) => {
  // Attach track immediately when published
  publication.track.attach(videoElement);
});
await room.localParticipant.setCameraEnabled(true);
```

**Why This Works:**
- No guessing on delay time
- Immediate attachment when track is ready
- More reliable

### Fix 2: Follow-up Recording Button

**Added:**
- Error callback for debugging
- Console logging
- Explicit autoStart={false}
- Helper text

## 🧪 Testing Steps

### Test Video Display:

1. **Start game and buzz in**

2. **Open Browser Console (F12)**

3. **Look for these exact logs:**

   ```
   Setting up video stream, isMyTurn: true
   Local video element found: true
   Camera not found, enabling and listening for track...
   Camera enable request sent
   Camera enabled for answerer  (from useGameState)
   Track published: camera video  (NEW - from event listener)
   Camera track published! Attaching...  (NEW)
   Successfully attached camera track  (NEW)
   ```

4. **If you see "Successfully attached camera track":**
   - Video SHOULD be visible
   - If not, check video element with: `document.getElementById('answerer-local-video')`

5. **If you DON'T see "Track published":**
   - Camera enable failed
   - Check browser permissions
   - Try refreshing and allowing camera access

### Test Follow-up Recording:

1. **Complete main question (90s)**

2. **Wait for AI to analyze**

3. **When follow-up question appears:**
   - Should see: "Click to record your 30-second response"
   - Should see button: "Record Answer (30s)"

4. **Click the button**
   - Recording should start immediately
   - Should see timer counting down

5. **If nothing happens:**
   - Open console
   - Click button again
   - Look for errors

6. **If recording works but doesn't submit:**
   - Look for: "Follow-up answer completed: 0 [transcript...]"
   - Look for: `POST /api/game/transcribe 200`
   - Look for: `POST /api/game/final-score 200`

## 🐛 Common Issues & Solutions

### Issue 1: "waiting for pending publication promise timed out"

**This is a LiveKit warning, not an error.**

**What it means:**
- Camera is being enabled
- LiveKit is publishing the track
- Taking longer than expected

**Solution:**
- Ignore this warning
- The event listener will catch the track when ready
- Look for "Track published" log instead

### Issue 2: Video Element Exists But No Video

**Check in Console:**
```javascript
// Check if element exists
document.getElementById('answerer-local-video')

// Check if track is attached
document.getElementById('answerer-local-video').srcObject
```

**Should see:**
- Element exists: `<video>` element
- srcObject: MediaStream object

**If srcObject is null:**
- Track not attached
- Event listener didn't fire
- Check for "Track published" log

### Issue 3: Follow-up Button Shows But Doesn't Work

**Debug Steps:**

1. **Check if button is rendered:**
   ```javascript
   // In console
   document.querySelectorAll('button').length
   ```

2. **Check isMyTurn value:**
   - Add console.log in GameUI
   - Should be true for answerer

3. **Check AudioRecorder props:**
   - maxDuration: 30
   - onRecordingComplete: function exists
   - autoStart: false

**If button exists but onClick doesn't fire:**
- React event handling issue
- Try clicking in different area
- Check browser console for JavaScript errors

### Issue 4: Audio Transcription Fails (400 Error)

**Current Error from logs:**
```
The audio file could not be decoded or its format is not supported.
```

**Attempted Fix:**
- Auto-detect supported mime types
- Try: audio/webm → audio/mp4 → audio/ogg
- Log actual format being used

**If still failing:**

Check browser audio format:
```javascript
// In console
MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
```

**Safari users:**
- May only support audio/mp4
- Whisper API should accept mp4

**Manual test:**
1. Make a short recording (5s)
2. Check console for "Audio blob created: { size: X }"
3. If size < 1000 bytes, recording failed
4. Check microphone permissions

## 📊 Expected Complete Console Log Flow

### 1. Buzzing and Winning:
```
Sending game message: BUZZ_IN
Game message sent successfully: BUZZ_IN
Sending game message: BUZZ_WINNER
Camera enabled for answerer
```

### 2. Video Setup:
```
Setting up video stream, isMyTurn: true
Local video element found: true
Camera not found, enabling and listening for track...
Camera enable request sent
Track published: camera video
Camera track published! Attaching...
Successfully attached camera track
```

### 3. Audio Recording:
```
Using mime type: audio/webm;codecs=opus
Audio blob created: { size: 330311, type: "audio/webm;codecs=opus", chunks: 1 }
Uploading audio as: recording.webm
POST /api/game/transcribe 200 in 2194ms
```

### 4. AI Analysis:
```
Sending game message: ANSWER_SUBMITTED
Camera disabled after answering
POST /api/game/evaluate-answer 200 in 13617ms
Sending game message: FOLLOWUP_READY
```

### 5. Follow-up Recording:
```
Follow-up answer completed: 0 "This is my follow-up answer..."
POST /api/game/transcribe 200 in 1500ms
POST /api/game/final-score 200 in 3000ms
```

### 6. Scoring:
```
Sending game message: SCORE_READY
```

## 🎯 Quick Checklist

Before reporting issues, verify:

### Video Issues:
- [ ] Browser has camera permission (check browser address bar)
- [ ] No other app is using camera
- [ ] Using HTTPS or localhost
- [ ] Console shows "Track published: camera video"
- [ ] Console shows "Successfully attached camera track"

### Follow-up Button Issues:
- [ ] You are the one who answered (isMyTurn = true)
- [ ] Follow-up question is displayed
- [ ] Button "Record Answer (30s)" is visible
- [ ] Button is not disabled
- [ ] Console shows no JavaScript errors

### Audio Issues:
- [ ] Browser has microphone permission
- [ ] Console shows "Using mime type: ..."
- [ ] Console shows "Audio blob created: { size: > 1000 }"
- [ ] No "The audio file could not be decoded" error

## 💡 Quick Fixes to Try

### If Video Doesn't Show:

**Option 1: Manually Enable Camera First**
1. Before entering game mode
2. Click "Start Broadcasting" once
3. Then stop broadcasting
4. Now try game mode

**Option 2: Check Camera Access**
```javascript
// In console
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('Camera works!', stream);
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => console.error('Camera error:', err));
```

**Option 3: Refresh Everything**
1. Close all browser tabs
2. Restart dev server
3. Clear browser cache
4. Open fresh tab

### If Follow-up Button Doesn't Work:

**Check in Console:**
```javascript
// Are you the answerer?
// Should match your identity
console.log('Current answerer:', gameState.currentAnswerer);
console.log('My identity:', identity);
console.log('Is my turn:', isMyTurn);
```

**Force test AudioRecorder:**
```javascript
// Manually test if recorder works
const recorder = new MediaRecorder(
  await navigator.mediaDevices.getUserMedia({ audio: true })
);
console.log('Recorder state:', recorder.state);
```

## 🚀 Rebuild and Test

```bash
# 1. Stop server (Ctrl+C)

# 2. Clean Next.js cache
rm -rf .next

# 3. Restart
npm run dev

# 4. Open fresh browser tab
# 5. Allow all permissions when prompted
# 6. Test again
```

## 📝 Report Template

If still not working, please share:

```
**Video Issue:**
- [ ] Console shows: "Track published: camera video" (Yes/No)
- [ ] Console shows: "Successfully attached camera track" (Yes/No)
- [ ] Video element exists: (run in console) document.getElementById('answerer-local-video')
- [ ] Video srcObject: (run in console) document.getElementById('answerer-local-video').srcObject

**Follow-up Issue:**
- [ ] Follow-up question displayed: (Yes/No)
- [ ] Button visible: (Yes/No)
- [ ] isMyTurn value: (check console logs)
- [ ] Any console errors: (copy/paste)
```

This will help diagnose the exact issue!

