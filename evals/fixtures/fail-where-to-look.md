<!-- mr-brief v1 -->

Deactivated subscriptions no longer come back from the lookup the payments service uses.

**Why:** the payments service charged a subscription that had been deactivated, because the lookup still returned it.

### Key changes
- **The lookup asks only for active subscriptions** — a dead one resolves to nothing instead of being served
- **`blocked` is its own field** — a subscription can be paid up and blocked at once
- **The subscription says which plan it pays for** — no second call needed

### Where to look · ~5 min · skip the specs
**Start →** [subscription_controller.rb:18](https://gitlab.example.com/g/r/-/blob/abc123/app/controllers/subscription_controller.rb#L18) — the payments service's lookup arrives here; follow `show` into the service
- [ ] [subscription_service.rb:49](https://gitlab.example.com/g/r/-/blob/abc123/app/models/subscription_service.rb#L49) — the one line that changes behaviour
- [ ] [subscription_serializer.rb:8](https://gitlab.example.com/g/r/-/blob/abc123/app/serializers/subscription_serializer.rb#L8) — is `blocked` sent next to the paid state, not folded into it? · key change 2
- [ ] [account_serializer.rb:59](https://gitlab.example.com/g/r/-/blob/abc123/app/serializers/account_serializer.rb#L59) — does this payload name the plan, so the caller needs no second call? · key change 2

### Risk
> a charge that used to find a dead subscription now finds none and is refused. Loudly.
>
> Rollback: revert. No migration.
