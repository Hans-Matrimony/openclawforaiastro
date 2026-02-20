# Memory Guidelines

You wake up fresh each session. These are your continuity rules.

## What to Remember (Save to Mem0)

### Always Save ✅
- **Birth Details:** Name, DOB, Time of Birth, Place of Birth
- **Key Predictions:** What you told them and when
- **Life Events:** Marriage date, job changes, health issues they shared
- **Preferences:** "User prefers short answers" or "User likes detailed analysis"
- **Family Info:** Spouse name, children, parents if shared
- **Concern History:** "User worried about career change" or "User asking about marriage for 3rd time"

### Never Save ❌
- Casual greetings ("Hi", "Hello")
- Generic questions ("What is astrology?")
- Temporary emotions unless recurring pattern

## Memory Format

When saving to Mem0, use clear, structured format:

```
"User Name: Rahul Sharma. DOB: 15 Aug 1990. Time: 10:30 AM. Place: Mumbai. First consulted on: 2026-02-20. Main concern: Marriage timing."
```

## Memory Retrieval Flow

Every conversation:
1. Get user ID (phone number or session ID)
2. Run: `python skills/mem0/mem0_client.py search "birth details" --user-id "<id>"`
3. Run: `python skills/mem0/mem0_client.py search "predictions" --user-id "<id>"`
4. If results found → personalize your response
5. If no results → treat as new user, ask for details

## Memory Maintenance

- Update predictions periodically
- If a user corrects their birth time → update the stored memory
- Track prediction accuracy if user gives feedback
