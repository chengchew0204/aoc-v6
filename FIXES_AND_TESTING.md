
# Bug Fixes and Testing Guide

## ✅ Fixed Issues

### 1. Only 1 Follow-up Question Now
**Changed:** AI now generates EXACTLY ONE follow-up question instead of 1-2

**File:** `src/app/api/game/evaluate-answer/route.ts`
- Prompt explicitly states "EXACTLY ONE"

### 2. AI Rating Auto-Starts After Follow-up
**Fixed:** After answering the follow-up question, AI rating now automatically starts

**Implementation:**
- When follow-up answer submitted, automatically triggers final score calculation
- 500ms delay to ensure state is updated
- No manual intervention needed

### 3. Video Display Issues
**Enhanced:** Added extensive logging to debug video attachment

**Debug Steps:**
1. Open browser console (F12)
2. Watch for these logs when answering:
   ```
   Setting up video stream, isMyTurn: true
   Local video element found: true
   Camera publication found: true/false
   Attached local video for answerer
   ```

**Common Issues:**

- **Video element not found**: Check that you're in ANSWERING stage
- **No camera publication**: Camera needs to be enabled first
- **Track not available**: Wait 1 second for track to propagate

### 4. Audio Format Compatibility
**Fixed:** Better audio format detection and compatibility with Whisper API

**Changes:**
- Try multiple audio formats (webm, mp4, ogg)
- Log actual mime type being used
- Proper file extension based on format
- Console logs for debugging

## 🎮 Complete Game Flow

```
1. Question Display (10s countdown animation)
   ↓
2. Buzzing Stage
   ↓
3. Winner Determined
   ↓
4. Camera Auto-Enables for Winner ⚡
   ↓
5. Answering Stage (90s)
   - Video shows on screen for everyone
   - Audio recording happens simultaneously
   ↓
6. Answer Submitted
   - Camera auto-disables
   - AI analyzes answer
   ↓
7. Follow-up Question Appears (EXACTLY 1) ✅
   ↓
8. Answer Follow-up (30s)
   ↓
9. AI Rating AUTO-STARTS ✅
   ↓
10. Score Display
```

## 🐛 Troubleshooting

### Problem: Video Not Showing When Answering

**Check Console Logs:**
```javascript
// Should see these logs:
Setting up video stream, isMyTurn: true
Local video element found: true
Camera publication found: false  // First time
Enabling camera...
Camera enabled successfully
After delay - Camera publication: true  // After 1 second
Attached newly enabled camera
```

**If "Local video element found: false":**
- Bug in UI rendering
- Check that GameUI is properly mounted
- Verify GameStage is ANSWERING

**If "Camera publication found: false" forever:**
- Browser camera permission denied
- Camera being used by another app
- Check browser settings

**If video element exists but stays black:**
- Track attachment failed
- Try manually granting camera permission
- Reload page and try again

### Problem: Follow-up Rating Doesn't Start

**Checklist:**
- [ ] Did you answer the follow-up question (30s recording)?
- [ ] Did the recording finish (not stopped early)?
- [ ] Check console for "Failed to calculate final score" errors
- [ ] Check OpenAI API key and credits

**Debug:**
1. Open console
2. Look for: `POST /api/game/final-score 200` or errors
3. If 500 error, check terminal server logs
4. If 429 error, OpenAI quota exceeded

### Problem: Audio Transcription Fails

**Error:** "The audio file could not be decoded"

**Solutions:**

1. **Check Audio Format:**
   - Open console
   - Look for: "Using mime type: ..."
   - Should be one of: audio/webm, audio/mp4, audio/ogg

2. **Check Recording:**
   - Look for: "Audio blob created: { size: X, type: ..., chunks: Y }"
   - Size should be > 0
   - Chunks should be > 0

3. **Browser Compatibility:**
   - Chrome: Usually works with audio/webm
   - Safari: May need audio/mp4
   - Firefox: Usually audio/webm or audio/ogg

4. **Manual Test:**
   - Speak clearly for 5-10 seconds
   - Check file size in console
   - If size is very small (<1000 bytes), recording might have failed

## 📊 Expected Console Output

### During Question Generation:
```
Sending game message: NEW_QUESTION
Game message sent successfully: NEW_QUESTION
```

### When Buzzing In:
```
Sending game message: BUZZ_IN
Game message sent successfully: BUZZ_IN
```

### When Winner Determined:
```
Camera enabled for answerer
```

### When Answering Starts:
```
Setting up video stream, isMyTurn: true
Local video element found: true
Camera publication found: true
Attached local video for answerer
```

### When Recording:
```
Using mime type: audio/webm;codecs=opus
Audio blob created: { size: 125000, type: "audio/webm;codecs=opus", chunks: 15 }
Uploading audio as: recording.webm
```

### When Transcription Succeeds:
```
POST /api/game/transcribe 200 in 2500ms
```

### When Follow-up Answer Submitted:
```
Sending game message: FOLLOWUP_ANSWER_SUBMITTED
POST /api/game/final-score 200 in 3000ms
```

### When Score Ready:
```
Sending game message: SCORE_READY
```

## 🧪 Testing Checklist

### Countdown Test
- [ ] Numbers are large (8xl font)
- [ ] Numbers pulse/animate
- [ ] Yellow ring animates
- [ ] Counts: 10 → 9 → 8 → ... → 0
- [ ] Auto-transitions to BUZZING

### Question Quality Test
- [ ] Questions are SHORT (2-3 sentences)
- [ ] Questions are about Emergence concepts
- [ ] Questions are in English
- [ ] Questions are answerable in 90 seconds

### Video Test (Single Player)
- [ ] Buzz in and win
- [ ] Camera permission popup appears (first time)
- [ ] Video shows in center of screen
- [ ] "LIVE - You" indicator visible
- [ ] Video feed is smooth
- [ ] After recording, video disappears

### Video Test (Multi-player)
- [ ] Player 1: Buzz in and win
- [ ] Player 1: See own video
- [ ] Player 2: See Player 1's video
- [ ] Player 2: "LIVE - [Player 1 name]" visible
- [ ] Both players see same video
- [ ] After answer, video disappears for both

### Follow-up Flow Test
- [ ] Answer main question (90s)
- [ ] AI generates EXACTLY 1 follow-up
- [ ] Follow-up displays correctly
- [ ] Can record 30s answer
- [ ] After follow-up submission, rating AUTO-STARTS
- [ ] Score displays correctly

### Audio Test
- [ ] Microphone permission granted
- [ ] Recording countdown works
- [ ] Can stop early
- [ ] Console shows audio blob size > 0
- [ ] Transcription succeeds (200 status)
- [ ] Transcript appears in evaluation

## 🔧 Quick Fixes

### If Video Doesn't Show:

```javascript
// Check in console:
room.localParticipant.getTrackPublication(Track.Source.Camera)

// Should return an object with .track property
// If null, camera is not enabled
```

**Fix:**
1. Reload page
2. When prompted, allow camera access
3. Try buzzing in again

### If Audio Fails:

Check mime type support:
```javascript
// In console:
MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
MediaRecorder.isTypeSupported('audio/webm')
MediaRecorder.isTypeSupported('audio/mp4')
```

**Fix:**
1. Use Chrome (best support)
2. Check microphone permissions
3. Try recording a short test

### If Follow-up Rating Doesn't Start:

**Manual Check:**
1. Did the follow-up recording finish?
2. Check console for errors
3. Look for `POST /api/game/final-score` request
4. Check response status (should be 200)

**If stuck:**
- Refresh page and try again
- Check OpenAI API credits
- Verify .env.local settings

## 📋 Pre-Flight Checklist

Before testing, ensure:

- [ ] `.env.local` has `OPENAI_API_KEY`
- [ ] OpenAI account has credits
- [ ] Camera permission granted in browser
- [ ] Microphone permission granted in browser
- [ ] Using Chrome, Safari, or Edge (latest version)
- [ ] Dev server restarted after code changes
- [ ] Browser page refreshed

## 💡 Tips for Successful Testing

1. **Use Chrome** - Best WebRTC and MediaRecorder support
2. **Test with 2 devices** - See true multiplayer sync
3. **Watch Console** - All operations are logged
4. **Be Patient** - AI calls take 2-5 seconds
5. **Speak Clearly** - Helps Whisper API transcription

## 🎯 Success Criteria

Game is working correctly when:

✅ Countdown animates smoothly  
✅ Questions are short and clear  
✅ Video shows when answering  
✅ AI generates 1 follow-up  
✅ Rating starts automatically  
✅ All stages transition smoothly  
✅ No console errors  

Happy testing! 🚀

