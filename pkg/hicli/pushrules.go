// Copyright (c) 2024 Tulir Asokan
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package hicli

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rs/zerolog"
	"maunium.net/go/mautrix"
	"maunium.net/go/mautrix/event"
	"maunium.net/go/mautrix/id"
	"maunium.net/go/mautrix/pushrules"

	"go.mau.fi/gomuks/pkg/hicli/database"
)

type pushRoom struct {
	ctx    context.Context
	roomID id.RoomID
	h      *HiClient
	ll     *mautrix.LazyLoadSummary
	pl     *event.PowerLevelsEventContent
}

func (p *pushRoom) GetOwnDisplayname() string {
	// TODO implement
	return ""
}

func (p *pushRoom) GetMemberCount() int {
	if p.ll == nil {
		room, err := p.h.DB.Room.Get(p.ctx, p.roomID)
		if err != nil {
			zerolog.Ctx(p.ctx).Err(err).
				Stringer("room_id", p.roomID).
				Msg("Failed to get room by ID in push rule evaluator")
		} else if room != nil {
			p.ll = room.LazyLoadSummary
		}
	}
	if p.ll != nil && p.ll.JoinedMemberCount != nil {
		return *p.ll.JoinedMemberCount
	}
	// TODO query db?
	return 0
}

func (p *pushRoom) GetEvent(id id.EventID) *event.Event {
	evt, err := p.h.DB.Event.GetByID(p.ctx, id)
	if err != nil {
		zerolog.Ctx(p.ctx).Err(err).
			Stringer("event_id", id).
			Msg("Failed to get event by ID in push rule evaluator")
	}
	return evt.AsRawMautrix()
}

func (p *pushRoom) GetPowerLevels() *event.PowerLevelsEventContent {
	if p.pl != nil {
		return p.pl
	}
	evt, err := p.h.DB.CurrentState.Get(p.ctx, p.roomID, event.StatePowerLevels, "")
	if err != nil {
		zerolog.Ctx(p.ctx).Err(err).
			Stringer("room_id", p.roomID).
			Msg("Failed to get power levels in push rule evaluator")
		return nil
	} else if evt == nil {
		zerolog.Ctx(p.ctx).Warn().
			Stringer("room_id", p.roomID).
			Msg("Power level event not found in push rule evaluator")
		return nil
	}
	err = json.Unmarshal(evt.Content, &p.pl)
	if err != nil {
		zerolog.Ctx(p.ctx).Err(err).
			Stringer("room_id", p.roomID).
			Msg("Failed to unmarshal power levels in push rule evaluator")
		return nil
	}
	createEvt, err := p.h.DB.CurrentState.Get(p.ctx, p.roomID, event.StateCreate, "")
	if err != nil {
		zerolog.Ctx(p.ctx).Err(err).
			Stringer("room_id", p.roomID).
			Msg("Failed to get creation content in push rule evaluator")
		return nil
	} else if createEvt == nil {
		zerolog.Ctx(p.ctx).Warn().
			Stringer("room_id", p.roomID).
			Msg("Create event not found in push rule evaluator")
		return nil
	} else {
		p.pl.CreateEvent = createEvt.AsRawMautrix()
		_ = p.pl.CreateEvent.Content.ParseRaw(event.StateCreate)
	}
	return p.pl
}

var (
	_ pushrules.EventfulRoom      = (*pushRoom)(nil)
	_ pushrules.PowerLevelfulRoom = (*pushRoom)(nil)
)

// Reports whether evt invites this account to a room, which is the only membership
// change allowed to notify. Anything unparsed is treated as not an invite: failing
// closed here only costs a missed badge, while failing open restores the noise.
func isInviteForMe(h *HiClient, evt *event.Event) bool {
	if evt.GetStateKey() != string(h.Account.UserID) {
		return false
	}
	content, ok := evt.Content.Parsed.(*event.MemberEventContent)
	return ok && content.Membership == event.MembershipInvite
}

func (h *HiClient) evaluatePushRules(ctx context.Context, llSummary *mautrix.LazyLoadSummary, baseType database.UnreadType, evt *event.Event) (database.UnreadType, string) {
	if !h.firstSyncReceived && baseType == database.UnreadTypeNone {
		// Skip evaluating push rules that are unlikely to match for the initial sync
		return baseType, ""
	}
	rule := h.PushRules.Load().GetMatchingRule(&pushRoom{
		ctx:    ctx,
		roomID: evt.RoomID,
		h:      h,
		ll:     llSummary,
	}, evt)
	if rule == nil {
		return baseType, ""
	}
	combinedRuleID := fmt.Sprintf("%s:%s", rule.Type, rule.RuleID)
	should := rule.GetActions().Should()
	if should.Highlight {
		msg, ok := evt.Content.Parsed.(*event.MessageEventContent)
		// TODO make the number configurable and/or consider room settings?
		if ok && msg.Mentions != nil && len(msg.Mentions.UserIDs) > 15 {
			return baseType, combinedRuleID
		}
	}
	// Membership churn does not earn a badge. Older Synapse defaults ship
	// .m.rule.member_event with `notify` rather than the current spec's empty action
	// list, so on those accounts every join, leave and profile change counts as a
	// notification — one person being re-added to twenty rooms lights up the whole
	// room list. The events still render in the timeline; this only stops them
	// driving unread counts and notifications.
	//
	// Invites for this account are the deliberate exception: being invited somewhere
	// is the one membership change worth interrupting for, and it is what
	// .m.rule.invite_for_me exists to catch.
	if evt.Type == event.StateMember && !isInviteForMe(h, evt) {
		return baseType, combinedRuleID
	}
	if should.Notify {
		baseType |= database.UnreadTypeNotify
	}
	if should.Highlight {
		baseType |= database.UnreadTypeHighlight
	}
	if should.PlaySound {
		baseType |= database.UnreadTypeSound
	}
	return baseType, combinedRuleID
}

func (h *HiClient) LoadPushRules(ctx context.Context) {
	rules, err := h.Client.GetPushRules(ctx)
	if err != nil {
		zerolog.Ctx(ctx).Err(err).Msg("Failed to load push rules")
		return
	}
	h.receiveNewPushRules(ctx, rules)
	zerolog.Ctx(ctx).Debug().Msg("Updated push rules from fetch")
}

func (h *HiClient) receiveNewPushRules(ctx context.Context, rules *pushrules.PushRuleset) {
	h.PushRules.Store(rules)
	// TODO set mute flag in rooms
}
