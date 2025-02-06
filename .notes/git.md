Some annotated commit manual tests, search for :
## Commit looked at
XXX Bad
++ Interesting


commit 45c77b8a055e6a51a619b50c08e2d41ca66e4c7e
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Feb 5 15:15:56 2025 +0100

    [Chat] Fix tests backend and add tests

commit d0235207b9385ba0f43fff2660f05be7487f581b
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Feb 5 12:42:06 2025 +0100

    Fix Chat Template

commit 0d17e0ed299af557339f6e08455a22d338007ea3
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Feb 4 21:20:39 2025 +0100

    [Chat] Integrate with jpv and store

commit 48c3016a400d573dd4f619164b9e5fce9e09a7f3
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Feb 4 16:43:47 2025 +0100

    Fix: JaiPasVu custom emit, HTMXPlugin history push and Room init

commit 3eee36f95b459377490d296890a96c8394d0f95f
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Feb 4 14:20:21 2025 +0000

    Adding pushed into history event listening for HTMXPlugin

commit 7947253be142f4c061f9220b7276db4e3aea8ddf
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Feb 4 11:49:09 2025 +0000

    Removing unwanted triggerHeader searches

commit 24eb79693836e3ed566c60183c1a4b94f456f3c6
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Feb 4 12:11:21 2025 +0100

    [HTMX] Fix user state sync

commit 63158338aa7795badd2dbe60301ba6a61d4026f1
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Feb 4 00:13:12 2025 +0100

    [StateSync] Remove in favor of per-module syncing

commit 37b34c3682313dde11f8c5f2839651bb68ea44e5
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Feb 4 00:05:30 2025 +0100

    [Logging] Improve with caller

commit 2dc182ed512e0bb6c1ea15034504b45269d1ecdf
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Feb 3 18:59:25 2025 +0100

    Fix v-for, need to fix v-bind

commit b2e93aac5765362f41c0287e1a00ad28690d9afb
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Mon Feb 3 16:35:41 2025 +0000

    Fix: Remove unwanted code from room state
    
    Change game mode to AI as default

commit 0c9b8dd9f60948f2fed8b24174dc75f712de6c30
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Feb 3 16:03:05 2025 +0100

    Edit v-for to handle Sets, Objects and Strings

commit 772b4b2f78787983eb1b44716ebfabe7d358abcb
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Sat Feb 1 13:34:19 2025 +0530

    Fix: issues with last commit

commit 6fea8d8e52306c646a27505064fcabaf43969b62
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jan 31 17:49:30 2025 +0000

    Fix: HTMX redirect to index page if already logged in

commit b6d6630bfe3d6eaa31168649fe85f2080ad96119
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jan 31 15:53:29 2025 +0100

    [cursorrules] Add project rules

commit 4978b76561e177bdaf831d6f75473f2da81543f1
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jan 31 14:38:44 2025 +0100

    [Networking] Simplify connection management and example for Room
    
    - Document store
    - Replace Store.getInstance() with direct store import across all files
    - Consolidate connection management into singleton connectionManager
    - Remove RoomNetworkManager in favor of simplified RoomConnectionManager
    - Update room components to use new connection architecture
    - Remove duplicate WebSocketConnection implementation

commit 4beeb2b1c6eb0fd4a17655e5838985e1dc34b104
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jan 31 13:53:46 2025 +0100

    [Room] Clean and integrate with states.
    
    Document JaiPasVu

commit 0aaa04673c3b69eef53bb722b93574ea7c503400
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Fri Jan 31 12:42:57 2025 +0100

    UPDATE: add back the AI manager's page

commit 80c5ed0ccc2f76778aa55f09725375154ba2dff6
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 22:12:39 2025 +0100

    [UIPlugin] Reduce interpolation rounds and simplify UI

commit afb18f45398d0eab63c0cb99c6cbfe9c575dd27e
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 20:40:19 2025 +0100

    [Frontend] Simplify State, UI and htmx

commit c6f51cc61a79470e0db4b856216a331d8b4ce8d4
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 18:11:44 2025 +0100

    [JaiPasVu]  Fix v-if / else + Add v-for tests

commit 1f25764af0dd3e250b117957e12798351a9c9a5a
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 17:28:29 2025 +0100

    [JaiPasVu] Add v-bind tests and fix one

commit 52f80c45e9ff39c26755876b6d2e2c74ff3ae941
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 15:46:16 2025 +0100

    [StateSync] Initialize

commit 4221bb5d3f5702eb75eaf30468b09d07b621a3a4
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Thu Jan 30 14:47:52 2025 +0100

    Fix form padding and Add leave template button

commit 198702ed9b088a09c2eb292231c8c48b27e07009
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 13:32:49 2025 +0100

    [JaiPasVu] Fix domain nesting and add tests

commit 38727b27dd1745a764fc416bfceb4654323d71b4
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 13:28:16 2025 +0100

    [Room] Fix data-domain and duplicate component

commit 4fdb6be11689440645731dd2ef228e3ed2beb5dc
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 30 11:51:45 2025 +0000

    Can start a game and enter the room
    
    Having issues with data not loading inside the game room

commit 9a764eca523e3db0eb579a4f3fcc51bb81dc9d75
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 12:24:13 2025 +0100

    [HTMX] Fix UI state management and HTMX integration
    
    - Refactor theme and font size handling into UI plugin methods
    - Enhance HTMX plugin with better initialization and event handling
    - Simplify state synchronization and DOM updates
    - Remove redundant code and improve component reinitialization

commit e4d924191dfedb21159d3b4d9be6bcd1f538aded
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 11:11:47 2025 +0100

    [HTMX] Fix Start a Game call

commit 368818ce7771076ab64aee08077359d45268c9aa
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 30 10:37:57 2025 +0000

    Proper implementation of navbar
    
    Commenting not needed tests

commit 8f99589f0900f2189edcef5a6cc522b8179bced1
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 30 09:51:38 2025 +0000

    Migrating the new pong tourny models

commit 0323b2d6c61bc7773cb47d444a7e52ae57467a7c
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 01:06:49 2025 +0100

    [JaiPasVu] Rename for easy usage

commit b0efaa5c0c4e2ec80bece8b0aec9a7b4f35adc65
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 30 00:57:37 2025 +0100

    [JavaisPasVu] Fix and stabilize : tests cover 67.42%

commit 2bc579af014887cf11cbae0e8514e8ab4d08579d
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Jan 29 15:42:53 2025 +0100

    ![JavaisPasVu] Restructure for closer API usage to vuejs

commit 06cb5cd54b72738ecf442c6355d313e028663720
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Jan 28 18:42:41 2025 +0100

    !refactor: state management and validation
    
    - Improve store architecture
    - Add UI state management with modals, toasts, and theme support
    - Refactor user state with simplified actions and better validation
    - Implement deep equality comparison for state updates
    - Add settings validation with schema-based approach
    - Update room state validators and reducers for better type safety
    - Optimize state updates to prevent unnecessary rerenders
    
    BREAKING CHANGE

## XXX - Frontend down
commit 1870a3d5687e88d4f9eea1d65e5d8920bf45be53
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jan 10 21:01:21 2025 +0100

    [Room] Fix settings drop

## XXX - Backend down
commit 25e9a3dad45321ef1fb9bcdab193a1647aa0c1fd
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 23 23:51:52 2025 +0530

    Add a function to calculate player ranking

commit 483056c15ab72ca83e749de6d136d7d5ccefedeb
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 23 23:16:28 2025 +0530

    Add a function to pair tournament players

commit 7d843fecad73ad8c988a27c97949bfc2766f0136
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jan 23 23:09:02 2025 +0530

    Add match model for pong tournaments

commit b475127ebe554238656ecc5c9d68afd595d61b9b
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Jan 20 16:52:39 2025 +0100

    Fix Chat Size and High Contrast Theme

commit 5d06ad2677caaae136dbb3624077696bbc694aab
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Jan 15 19:24:12 2025 +0100

    Fix High-Contrast Theme

commit 77125aebcbcca9006bc27299eaf1b5121eebd272
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Jan 15 13:57:59 2025 +0100

    UPDATE: reimplement the AI's manager page

commit eb7937451aedb274c70ebaa28f1319d8a2fcdce9
Merge: 95f4f6d 80aca89
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Jan 14 00:50:53 2025 +0530

    Merge branch 'main' of https://github.com/LuyNagda/transcendence

commit 95f4f6d0de54dfae93b67f8d0fc5ec69f272f5d0
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Jan 14 00:48:17 2025 +0530

    Fixing pong tournament model

commit 80aca89df87ab0e56e3e006f41c92347043b8af3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Jan 13 14:27:54 2025 +0100

    FIX: typo in class Tournament

commit 56399f1f1c61f8c526a89ff226f3c4f4937902c2
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jan 10 18:49:53 2025 +0000

    Changing names to shorter names in tourny model

commit 03c9c7476edfe0b8bb00e185de665cebf598e1d0
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jan 10 23:43:52 2025 +0530

    Fixing pong game having many to many relation

commit 8e7a3566a8db71615f8734ba99db5d6a2e64b69e
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jan 10 23:25:23 2025 +0530

    Introducing model for tournament


## XXX - New state management, not working
commit 3ce621e1b23214b9553c9d474d4fbb01bfb490ff
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jan 10 10:52:21 2025 +0100

    [Room] Improve Room structure and state mgt

commit d5082cbd69dd4e152c38658bed2697c4c6c247d7
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jan 9 04:36:47 2025 +0100

    [Room] improve room state management
make 
commit 47b5c9749c3ce79301e0666e9d716fcd7c13e425
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Jan 8 14:44:21 2025 +0100

    [Pong] AI integration : change difficulty topology

commit 2553a061949a50f3716f05cd6ecedd367041e6c8
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Jan 8 14:40:37 2025 +0100

    [DevOps] make clean only local images

commit 840abd4ab1e553c52dff9a70a2793e92c306c8fd
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Jan 8 14:07:57 2025 +0100

    feat: enhance room system and state management
    
    - Add room modes (AI, Classic, Ranked, Tournament) with mode-specific settings
    
    - Improve state validation and persistence
    
    - Refactor chat and user state handling
    
    - Optimize game state performance by skipping persistence
    
    - Add support for mode-specific player limits and settings

commit f154462bc55a77a08e736437845d57cc24060b70
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Dec 22 01:53:32 2024 +0100

    [Frontend] Add redux-like store - Rationalize services and networking

commit 33c9338baf7b82a4198c9e0ab814116e09861d66
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Dec 22 00:51:08 2024 +0100

    [Frontend] Refactor vendor deps

commit 5abe57ded23a87416dd33369916cf76239092a1f
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Dec 21 02:29:49 2024 +0100

    [Pong] Fix game complete issues

commit 7ecaee91cfaf6a2f7e4bce3e6ea0368ba81f5ff0
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Dec 21 01:26:22 2024 +0100

    [Frontend] Refactor networking - WS & RTC for chat and pong

commit fed355804c41b29516500fe13c653de8f6b5802c
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Dec 20 23:23:39 2024 +0100

    [Pong] Fix webrtc connection

commit 775cc5d38ae66aac99673f5c9443f28d64c6e8b3
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Dec 19 04:20:35 2024 +0100

    [Pong] Breaking - Separate host and guest logic

#######################
#######################
#######################
#######################
## ++-- Legacy - Room ettings synchro + / chat poc / !startgame
commit a8aaa44096210890bf800a5c1be763c778492077
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Dec 19 02:53:11 2024 +0100

    [Pong] Sync state through webrtc

commit 5e16b664bc92bc328c9ba51deec11d499d247530
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Dec 18 02:59:21 2024 +0100

    [Pong] Major room and settings refactoring

## XXX - Room broken
commit 7a9642edd66e6c4a72edbc2641f5a80fe1bcf7cc
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Dec 17 17:00:09 2024 +0100

    [Pong] Enable user settings - and add paddle speed

## XXX - Room ok - AI Change medium => Medium - et ws down
Failed to initialize AI controller: Error: Failed to fetch AI data: 404
    init AIController.js:129
commit b9d0651b0b7eda9e3adede542d348f97d38fdc14
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 9 14:38:58 2025 +0100

    UPDATE: fixe minor display issue

commit a44d166fffb0f1522efa51b08808c03f4e0e3bce
Merge: 66f01e8 087009f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 9 11:37:34 2025 +0100

    Merge branch 'main' of github.com:LuyNagda/transcendence

commit 66f01e803d23d30c6795ca267755908ddf6b03ba
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Jan 8 21:03:54 2025 +0100

    Enhance Chat Page Style

commit 5d480a12f9eec0f44ad38eeb845b05e099b2f8a3
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jan 8 17:16:54 2025 +0000

    Not logging out the user if he visit the main page accidently while logged in

commit 81e3152a5f63eb731c373ec086aa79c97812bd34
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 9 11:36:15 2025 +0100

    UPDATE: add new ai

commit 087009f5382dbabb93550f7613bb2cf0547a3144
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Jan 8 21:03:54 2025 +0100

    Enhance Chat Page Style

commit 0a976064a0615738e545e82f1f8a15e842cba29d
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jan 8 17:16:54 2025 +0000

    Not logging out the user if he visit the main page accidently while logged in

commit d6f42534f72d7451111c39ba2b251c11cc69da5c
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 19:16:46 2025 +0100

    UPDATE: clean: delete old ai

commit 1f35a5aefdebbf2995c0b399281166b2e1aba8b7
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 19:16:23 2025 +0100

    UPDATE: trained new ai

commit 12a8c2eb5f67e2aaeb6ca1c06f871caad959710a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:57:56 2025 +0100

    UPDATE: update main.py for manual training

commit b487fc3916fe14be7df76e3d2a167da775ee69a3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:49:31 2025 +0100

    UPDATE: backend game unification with the frontend revision

commit 38b595cb299df8645624c78ab77f4aac855c7678
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:49:00 2025 +0100

    UPDATE: GameState's constructor take parameters from GameRules.js

commit 796f520de6e3d7a9890542dcf4e6734989603a7c
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:40:09 2025 +0100

    UPDATE: GameState's constructor take parameters from GameRules.js

commit e0c90f0523b697a990984eae32ef78727ce72397
Merge: dcd1021 d6acc6a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:15:26 2025 +0100

    Merge branch 'Game-balance' of github.com:LuyNagda/transcendence into Game-balance

commit dcd1021f34bc92cf1aa2ae364b0b652123642108
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:14:46 2025 +0100

    UPDATE: rebase main

commit c62b5259c84a597010e8a842350cc24702941ea9
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 14:52:31 2025 +0100

    UPDATE: use the GameRules.js variable instead of hard coding numbers

commit 2a546e2ae79cb35cc877a01331c642b89e84b766
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 14:51:39 2025 +0100

    UPDATE: Add static PADDLE_HEIGHT to the GameRules.js

commit b0e03505e2d5ee3fd1df55a81ef95608bd4f256f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:08:22 2025 +0100

    UPDATE: add placeholder AI

commit 53ba0a5a8ff80e4c8e782b344b320929938fcd11
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 17:07:24 2025 +0100

    UPDATE: reinstate the _savedAi in the PongRoom

commit 82f58246145bbc00e00993a330daa55fa7132d1f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 15:05:41 2025 +0100

    UPDATE: clean

commit d6acc6a6c374ebaacc90bc121b78bf29e48277e9
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 14:52:31 2025 +0100

    UPDATE: use the GameRules.js variable instead of hard coding numbers

commit 73f65ddb75c9d5d1e52ca7b5f07b633ff9b53be3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jan 7 14:51:39 2025 +0100

    UPDATE: Add static PADDLE_HEIGHT to the GameRules.js

commit 1fc97883571484bc5c8549c1cfdc582f85aebe82
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 2 17:54:23 2025 +0100

    UPDATE: TODO: new AI's fetch function to implement in pong_room.js

commit b814f78808bed417da6a4558452070d90ff5c9cd
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 2 17:21:05 2025 +0100

    UPDATE: clean AiManager.js and archived old AI

commit 1a6cc859b590f96166beaee437aae07f07091aef
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 2 17:10:29 2025 +0100

    UPDATE: disable the buttons of the AI managers when request are being processed

commit b29178026d909880df70cf8243d2a992c834e796
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jan 2 17:00:06 2025 +0100

    UPDATE: populate the dropdown for deleting AI, but disable originals ones

commit df032a16c93605e965fd81e5cf6696b243c5acfe
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 30 19:55:27 2024 +0100

    UPDATE: clean, no more document.addEventListener('DOMContentLoaded', () => {} in AiManager.js

commit 2a5a915307910a841a4276eab2d911f890989cd4
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 30 18:21:20 2024 +0100

    UPDATE: fix the server's response when deleting an AI

commit 9b2f7f459b1ccfd472464774ee8346c08e87c5bb
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 30 17:49:27 2024 +0100

    UPDATE: clean try to unify code

commit 8b1cd3f86465d4f066f756621e596be0a0413f3a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 30 16:35:40 2024 +0100

    UPDATE: clean and rename the ai's page to ai-manager.html

commit 3ca4c732809219df4871c55795f3fc9a8c6c7936
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 30 15:31:05 2024 +0100

    UPDATE: clean file but Error deleting AI: y.json is not a function

commit f95b58a63eda1f275f0fff1661523d5c62c8bf07
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 19:49:50 2024 +0100

    UPDATE: add a dropdout to selection with ai to delete

commit f7fb5d0208fdeda29aa97cf9f77c9027427df3ec
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 18:20:30 2024 +0100

    UPDATE: client send correctly the request for an AI to the server

commit 1af3e32339b0b6a1aa82f088a268a21bea39198b
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 18:07:16 2024 +0100

    UPDATE: replace ai_difficulty with ai_name

commit 8ce11f72cf1917383499618ad87e99d6735526aa
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 17:31:06 2024 +0100

    UPDATE: clean

commit bc6a3e2566d7d679ffcf058a77fcca999ce2f4d5
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 17:23:57 2024 +0100

    UPDATE: add a 'delete AI' button

commit f40e32f7134a40a5b57bb8af99f5acaef4847757
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 17:14:15 2024 +0100

    UPDATE: replace 'difficulty' from ai init by ai_name

commit e5f5070d414b813e41517dc1ab99010c27fad5ec
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Dec 27 13:14:24 2024 +0100

    UPDATE: clean

commit 75cd98b78942d52b885a701982e63a210d3243eb
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Tue Dec 24 17:11:44 2024 +0100

    UPDATE: lsit of saved ai in the server are now fetch when the room is created

commit 64d764919a2821cd9c544e226e7b353c0aedddc1
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Mon Dec 23 18:49:48 2024 +0100

    UPDATE: clean

commit 5fc127d13bb32a15cbbc4754736669ff72804ac3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Dec 19 23:49:33 2024 +0100

    UPDATE: clean useless AI

commit 10568d75276409f2d67fae74907b7db2f76853b3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Dec 19 23:49:01 2024 +0100

    UPDATE: add the function to request the back-end to train an AI

commit 9738617259cea906935b2c7772ba5b049f41834e
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Thu Dec 19 08:41:12 2024 +0100

    UPDATE: add some trained AIs

commit e46dce44291f27332e71b8c6e2cd62f32a7ed3a9
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 17:40:55 2024 +0100

    UPDATE: add some ais

commit 1cc2d231d5bc558c73d8db532490a017a357ae55
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 17:39:54 2024 +0100

    UPDATE: fix typo

commit 04d643b840998b7c7b071a1ea411307f68aeb486
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 17:12:01 2024 +0100

    UPDATE: move ai-training.html's script in another file

commit dca4e4522577c2c3796cdd022222e8ac0969666e
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 16:21:42 2024 +0100

    UPDATE: add a page for training AI without the functions

commit 3c744d626dadeb4d0e35b684fe9af0289be76411
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 13:04:52 2024 +0100

    UPDATE: change the name of AiController.js

commit aedb3068b4a10337caaca5c508a14b3411d94276
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 13:02:55 2024 +0100

    FIX: main.py to train without server

commit d83ce262a82a7d5de32a05d0008f4ff22ff93ab0
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 18 13:01:19 2024 +0100

    UPDATE: add a page for ai's training

commit 7c10ba29e51fccdd89eabbd0d2b9a86ec3b66221
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Dec 18 10:22:51 2024 +0100

    UPDATE: add some trained AIs

commit 80a3fdb8da1d04c483f6430711d3014b4d83860a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 17 17:00:22 2024 +0100

    UPDATE: move the unused function to another file, and prepare for new training

commit 9b67af3a7e240cb151951e05070ea40484c1a37a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 17 16:37:00 2024 +0100

    UPDATE: move the game's configuration of the ai's training in gameconfig.py and match them to the front game

#######################
#######################
#######################
#######################
## ++== Legacy interesting : AI ok et multi starts
commit 5cbc4e584b995a25de0819f941c779410b459c10
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Dec 17 12:26:19 2024 +0100

    [PONG] Make AI mode game work

commit 323660369dd6e700b0475cf5ab0203a59a3eca12
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Dec 17 11:23:48 2024 +0100

    [Pong] Default to AI game

commit bb2576e04af2c8042a87d291ecd48911a2edb7ed
Merge: 977b573 afdb211
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Dec 17 09:45:47 2024 +0100

    Merge branch 'AI-integration'

commit 977b573c630a93afeaa2f2d8a86707fd83f8fe22
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Dec 11 18:24:58 2024 +0100

    Fix index page

commit 2229e44fe270c739b10d52016a26b3537ab1e33b
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Dec 11 18:17:14 2024 +0100

    Add accessibility on pages

commit 830bb0a80d949f672fe7c7ae7a3b7d76bfa09777
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Dec 11 14:44:15 2024 +0100

    Edit index page

commit a8fb7e66f202ba4304b12072d9038a939db7a36e
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Dec 11 14:40:32 2024 +0100

    Edit index page

commit afdb211918f894b40dd214fac5982f5671aabc8d
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 10 19:19:29 2024 +0100

    FIX: in PongGameController.js, ai_aiController.decision() wasn't properly handle

commit 3eba99a58210b0fbef7ae47392021ce9ba4f93e7
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 10 19:03:47 2024 +0100

    FIX: server send already parsed JavaScript object ai, remove the json.parse() from the .js

commit 7ab6e75f405a26101704971d82eac26338ad4bd7
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 10 18:10:37 2024 +0100

    UPDATE: move the saved ais in transcendence/static/

commit 3589751fc7c0d0220d3f637715d2271d3c7aec91
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 10 14:53:52 2024 +0100

    Revert "Merge remote-tracking branch 'origin/main' into AI"
    
    This reverts commit d5b469fabe6a65b20ac66e0c32ac4b9c33f8589d, reversing
    changes made to 456bef4df993499e41d26171192c3f23238df21e.

commit 7ab7cb56fb4326f2753937139676372dc6ddb243
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Dec 10 14:45:47 2024 +0100

    UPDATE: new ai training

commit 2f8663ecac246a8d98eec348dda70f7a9c5b2e08
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 22:55:05 2024 +0100

    UPDATE: add backup savefile with the nb of generation

commit 4691da71caedb6f1f6e0066764e0aca9d7dab1ed
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 17:49:42 2024 +0100

    UPDATE: bestAI in a human-readable form

commit 6a584e96f4c88ba2794705141ed21421cb5913eb
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 17:48:38 2024 +0100

    UPDATE: saved ai are now save in a human-readable form

commit 1a4e19dbc40dc24006a0f65a13914d6269703594
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 17:47:57 2024 +0100

    UPDATE: AIController add comment

commit fbdb58f6993733923653497381876c7200d6ca2b
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 16:09:11 2024 +0100

    UPDATE: AIController now manage the delay of its ball's update

commit 85db0077746987ad2a4ad31cd65f61b070b0913a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 15:00:49 2024 +0100

    UPDATE: add documentation

commit d5b469fabe6a65b20ac66e0c32ac4b9c33f8589d
Merge: ad7d3bb 456bef4
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 14:39:07 2024 +0100

    Merge remote-tracking branch 'origin/main' into AI

commit ad7d3bb375b49999fd4d7fae152ebbe22c9d8994
Merge: 14956af 3abc54f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 9 14:36:21 2024 +0100

    Merge branch 'AI' of github.com:LuyNagda/transcendence into AI

commit 456bef4df993499e41d26171192c3f23238df21e
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Dec 9 14:16:37 2024 +0100

    Mute video

commit 991f699b59196e96507823e24ffc9a170a778565
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Dec 9 13:42:28 2024 +0100

    Add index page, Fix footer and game room

commit 1fdc4b597be3088723167c7df2406f890f15a0a4
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Dec 6 19:27:51 2024 +0100

    [AI] Integrate AI frontend - not working

commit 3abc54f2be7c5d487d292432e1e35c83d21be6f7
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Fri Dec 6 18:05:21 2024 +0100

    UPDATE: fix merge

commit b496bb8875b13a7c6ec3bcb1e7d49253a3d88445
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Dec 6 02:58:01 2024 +0100

    [Pong] Rearchitecture and render

commit 276219bf2a68f0f656ef7367b920ed83a33b7708
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Dec 5 23:03:19 2024 +0100

    [Pong] Integrate and fix many issues

####################### XXX
commit 14956af8d07e5e59588cae871394448318f6d6fd
Merge: c963b99 303bf38
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Dec 5 13:04:27 2024 +0100

    Merge remote-tracking branch 'origin/pong-integration' into AI

commit 303bf388180e497fecddc5cb9958cd3e80b5e0ce
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Dec 5 06:02:00 2024 +0100

    [WIP] Pong - Integrate pong

commit 7fa7311c6f3668e6be7bfc8c95ec78c2bb1a2718
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Dec 5 00:12:55 2024 +0530

    Working on making pong room SPA

commit c963b999faae6b0fd7bf5568d751557a474a867e
Merge: d9ae595 45afa6d
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 17:40:48 2024 +0100

    Merge remote-tracking branch 'origin/main' into AI

commit 45afa6d379c7b329ef4c0bc6539a246c0082041f
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Dec 4 17:32:55 2024 +0100

    [Pong] Integrate with front structure - Fix some issues

commit d9ae59564e3a6c5aa0ff79df5848000b7e34c509
Merge: 0d38e44 548eec9
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 16:51:36 2024 +0100

    Merge branch 'main' into AI

commit 548eec921b6bb134c0dc6e933fc52378b591ef20
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 16:23:05 2024 +0100

    UPDATE: add dependence

commit 0d38e44a81e2eccec87f3084df46727a388b02bb
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 16:22:35 2024 +0100

    UPDATE: add dependence

commit 21b09b2faa57176b2a648964230b008a6e2ffa74
Merge: 29f3eb6 de8d979
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 16:16:52 2024 +0100

    Merge remote-tracking branch 'origin/AI'

commit 29f3eb6468ac424c895e386edae0ab39bd261b8f
Merge: 296a2cb dcfc2db
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Dec 4 16:14:43 2024 +0100

    Merge branch 'rtc-game-engine'

commit 296a2cb1927534056da2f7082f4f51e79bc2c7b8
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Dec 4 16:03:58 2024 +0100

    Fix: Closing button color and Chat font size

commit de8d9796338a4aa7981fd7e6f25d9ef55494d893
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 15:21:16 2024 +0100

    UPDATE: use every cpu available except one

commit eba3a63485aa3a8c0930982d713bec6dde43b1bf
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 15:17:21 2024 +0100

    UPDATE: protect the game_config values

commit a25000cf93ba90219bda6243789ca7ad942da928
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Dec 4 14:11:40 2024 +0100

    UPDATE: add multiprocessing and simplify code

commit 106e925ac50418cc78962171d27bb444890b5e57
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 2 16:34:27 2024 +0100

    UPDATE: simplify app structure

commit 498af835ba2ec170c7c3e9a192cce3080cc85a11
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 2 15:55:52 2024 +0100

    UPDATE: clean

commit f1752b6e7c8bdbfb46b970056be04554be71c0b5
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 2 15:52:06 2024 +0100

    UPDATE: add the possibility to delete a saved ai

commit 2c190e0658c17dacf59637103c6d6add09bfcf6a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 2 15:37:13 2024 +0100

    UPDATE: add the possibility to request a list of the saved ai

commit 85d33e4d7a0f58ac37e374bcb45e6ae5e868570e
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Dec 2 15:22:27 2024 +0100

    UPDATE: add the possibility to train with different configuration

commit 7d184cadaa898c2b8e3eb84001f5b51d9d6548ac
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Sat Nov 30 17:47:51 2024 +0100

    UPDATE: add the possibility to train via the front-end

commit 970159f476f8f5c9704809ffc449f7c8d63274cf
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 17:50:26 2024 +0100

    UPDATE: better use of FileNotFoundError exception

commit 37a4a67a9accb6871c671def4800659d04a5289c
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 17:42:41 2024 +0100

    UPDATE: add possibility to request a specific AI

commit 5f925782b80f75c11aaf9596aea3568c414bd173
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 16:45:58 2024 +0100

    UPDATE: configure transcendence's urls.py with the ai's app

commit ef748ffd337293ba9bad791c37eea778856e4e88
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 16:43:01 2024 +0100

    UPDATE: move send_ai_to_front() to views.py and configure correctly the ai's app

commit c6487fbcda916b91d582649d41ffc4a450a6e3b0
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 16:35:02 2024 +0100

    UPDATE: clean import

commit d649a549120b00bcc4e1a231c14a3c4fbece9c66
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 16:32:17 2024 +0100

    UPDATE: delete obseletes saved ai

commit 106ecb53c9472543a69b79bc5dfc1baab2480a8c
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 29 16:31:56 2024 +0100

    UPDATE: move temporaly unused file

commit c2b61ce41b6774da9c44e6cd6b71b4191a94f469
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 28 01:34:41 2024 +0100

    UPDATE: first step of ai implementation

commit 5d332444e60544454429dcfaaa6a3ff94fa36164
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 28 01:32:25 2024 +0100

    UPDATE: first step of ai implementation

commit 2e77efdfa17ed98334a80c981c8f217f5a23a4ca
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 28 01:31:28 2024 +0100

    UPDATE: rename of import to fix import issues with django

commit 2cb60509a40fc0367c75a583f9397ab86bcc70b5
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 26 16:21:36 2024 +0100

    UPDATE: clean: delete the tempory file game.html used for the development of the ai

commit c2a60eaa5bbd417e8ed90faf6b626801e9726525
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 26 16:18:34 2024 +0100

    UPDATE: implement the request to the backend for the ai

commit a585256c449f593b67133d2d23aeea56b792c4f0
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 26 16:17:33 2024 +0100

    UPDATE: implement the api request for the ai's save file

commit f8224c629f34f71fec6fdca46a611add1d0ec954
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 26 14:56:48 2024 +0100

    UPDATE: implement AI in the game page

commit 46220f1ccde07b358284a2420edeefb913e63d2b
Merge: cf315ed 11682c3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 26 14:14:12 2024 +0100

    Merge branch 'main' into AI

commit cf315ed3732b29aad0e44f3a5d44689b31b74125
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Tue Nov 26 11:44:04 2024 +0100

    UPDATE: add trained AI 6-6-3 narrow

commit dfd6ee04b40acf7a851919dc74abdaf627823a9f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Sun Nov 24 21:59:00 2024 +0100

    UPDATE: fix MAX_SCORE adaptation + BestAI 6-6-3

commit 7ed5aa5a424f0eb97261184637df8719112a8c92
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 22 11:33:34 2024 +0100

    UPDATE: remove AI's bonus score

commit ecd849f0eb89f2aa4f1c6fd7b4e4b60120be05f6
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 22 11:33:12 2024 +0100

    UPDATE: fix MAX_SCORE adaptation

commit a5b3421b54913e4a286933a6e19c3d99d9e016bb
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 17:40:47 2024 +0100

    UPDATE: MAX_SCORE adapt itself

commit 5664095c4f56270e3684b2d833bcc5490aea05e2
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 17:39:31 2024 +0100

    UPDATE: disable the predefine game

commit 0f81146c04fd7648e17a0d9138eacbe46fd02dd9
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 16:25:35 2024 +0100

    UPDATE: update ai.js for 3 layers neuron network

commit 25a54b2ed6035faf67eacb00fe6b096eaa5663c0
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 16:25:10 2024 +0100

    UPDATE: modify save_best_ai() to avoid sample of the same AI

commit 7f574913859b0149f7972bc3fc7075f42987d30a
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 15:03:06 2024 +0100

    UPDATE: remove obselete files

commit 3a6060e48597439d20f97c20f074f0eea48439ec
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 15:01:02 2024 +0100

    UPDATE: update ai.js for 3 layers neuron network

commit 442406ea15c941eddafd0a53d8773d9ceeed6d6e
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 14:58:46 2024 +0100

    UPDATE: saved_ai_to_json() print a better msg

commit 32f67dc52080b14cb96815509a71f9dacff8004f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 14:29:32 2024 +0100

    UPDATE: move function to main.py

commit 1495413884c7563b3b8e597b815065c1309bb36b
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 14:20:11 2024 +0100

    UPDATE: move saved_ai_to_json() in ai. py

commit cf9f4173cd064f42f9d6e8cf96cd09d72ab60903
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 21 14:19:35 2024 +0100

    UPDATE: use ai 6-6-3

commit 11682c37c6b32d0af721b593ce56224f2ddd3473
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Nov 20 08:08:42 2024 +0100

    Fix: js script loading between pages

commit 6aa26c358cb17291957150719aaf9dae2d7d2796
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 19 17:34:51 2024 +0100

    UPDATE: BestAI with 5-3 and biases

commit 84e4808c291feef5665636141c76b5b030a9b7a0
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 19 16:57:42 2024 +0100

    UPDATE: AI with 5-3 and biases

commit e7f82957773fcff327040adccadf9cc9736cdd26
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 19 15:55:45 2024 +0100

    UPDATE: after the predefine training, the ball is reset

commit 626ddc04d19c6d088cd705d378e89e5ca04d3c67
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 19 15:54:49 2024 +0100

    UPDATE: playing vs the AI is more like the front's game

commit 7803c39a7da52b8e1f17e1a5341eecbf00d9f623
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 19 14:26:54 2024 +0100

    UPDATE: fix the layer2 that wasn't correcly passed to new generations

commit e6d2f1e15815b8e5fe14d2c00e4067a659680c93
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Tue Nov 19 10:34:29 2024 +0100

    UPDATE: add trained AI 5-3

commit 69ea6ef03c25d617246db8a05e891fe708c03c29
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Sat Nov 16 20:44:55 2024 +0100

    UPDATE: add bestAI 3-3

commit a2750b436c3e7dc664e0d0432dc53d4da613f270
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Sat Nov 16 20:44:34 2024 +0100

    UPDATE: clean

commit a1aee58c63e70af1d748f8410b3bdfc02b816f4d
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Nov 13 20:26:15 2024 +0100

    UPDATE: delete useless file

commit 7509dbd82dd6ce3dc2aedf649a3d0287a507ef17
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Nov 13 20:25:00 2024 +0100

    UPDATE: .gitignore

commit 842369073535b2b4d75a8b48cafd43da6da0ef71
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Fri Nov 15 16:28:07 2024 +0100

    UPDATE: add a training mod without display and predefine training

commit dcfc2db79a020d2a73cd6403e334b3b6e81a2547
Author: Matisse <root@PC-PORTABLE-MATISSE>
Date:   Thu Nov 14 14:26:00 2024 +0100

    some fix, WIP

commit 78b9fc5c508348777f1fd9c4b9c5f6983d100777
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Nov 14 14:18:42 2024 +0100

    [Chat] Fix broken merge

commit ee82b8d3934ebdc188eb4c5ffe9bdc02d9d6c181
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Nov 8 00:33:30 2024 +0100

    [Chat] Fix user unselect on refresh

commit ce4f43c2da9567fb2ac6fc4f2cc4521298c31c4e
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Nov 7 23:53:19 2024 +0100

    [Chat] Update user list on new user online

commit 5eda4e2f3b5d9ecb09e400ebf3fb2eb96c820fb9
Merge: 6964d56 82a7db8
Author: Matisse <root@PC-PORTABLE-MATISSE>
Date:   Thu Nov 14 13:50:51 2024 +0100

    merged game archi

commit 82a7db8f20dd282a075534a3aba28f4c5ad8bbec
Author: Matisse <root@PC-PORTABLE-MATISSE>
Date:   Thu Nov 14 13:47:13 2024 +0100

    add webRTC p2p connection for game, need tests

commit 4ceaecef9906ce3120e93f7e57362ae86bdbbb7b
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Nov 13 18:21:21 2024 +0100

    UPDATE: fix the code to work with 2 layers of 3 neurons

commit 5f31eba99f6c5468880dab3ad2b100eacf7a5e90
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 18:57:51 2024 +0100

    UPDATE: fix pygame'fd leaks

commit a57b487efc06e76dd894c573fb639c8969a7f282
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 16:57:59 2024 +0100

    UPDATE: try with 2 layers of 3 neurons

commit bfd06d8f8981b0e7e76849fbe1328157c8342d3e
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 16:50:58 2024 +0100

    UPDATE: fix Save_Best_Ai() when the dir already exist

commit db9002eeedd11a453a793c71e88c369c0c1a5273
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 16:40:37 2024 +0100

    UPDATE: fix Save_Best_Ai() when the dir already exist

commit 66998e1da59cccd0bf6fc94786607fd841d4eedc
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 16:06:24 2024 +0100

    UPDATE: delete archives

commit cf8c055c7afd1012e945749e004d392d23b5ea83
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:57:06 2024 +0100

    UPDATE: playing vs ai will always be with a max fps of 60

commit b0a65c52d98b07c2fcbe89fe21c9c8a809cbd5f8
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:52:19 2024 +0100

    UPDATE: fix main.py

commit ff151f2379eb762a313c80d2f317b0b93f480d3c
Merge: 7cbc023 163aa4c
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:49:23 2024 +0100

    Merge remote-tracking branch 'origin/AI' into AI

commit 7cbc02399721da341297fe98e5692a84e48e52bb
Merge: 7addbff 6964d56
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:47:32 2024 +0100

    Merge remote-tracking branch 'origin' into AI

commit 7addbff1d2d7e55871fa965a0e8518d8bf8688d4
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:45:05 2024 +0100

    UPDATE: save some ai

commit 1ce4ea223ade59a6e5fc31c1bfda2d1e4847fc25
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:44:46 2024 +0100

    UPDATE: archive some old files

commit a73889bbc14557931a407261a4376000065d2526
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Nov 12 15:44:22 2024 +0100

    UPDATE: Clean

commit 163aa4c7cf1a66e89fe8d4174b081ee3934ac2be
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Tue Nov 12 15:04:27 2024 +0100

    UPDATE: trained ai with 5 neurons

commit f69fc088e7619f8a421a2ea28c1aa137196aad95
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 7 17:31:13 2024 +0100

    UPDATE: Clean and add point to the AI base of the distance from the ball when it misses

commit f65d16d3271d5fce7d8c01d618238a0a763eb5eb
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Nov 7 17:28:03 2024 +0100

    UPDATE: You now have to provide a save file for the demo or playing vs AI

commit a52c0e421e383b1e85d7e35c792b18658c5f18d4
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 15:03:56 2024 +0100

    UPDATE: debug ai.py

commit 2790e317660274d60170ad73543523666e726fd4
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 15:03:08 2024 +0100

    UPDATE: clean

commit 9559efba3f7116e8a45b687a161acd560115735f
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 14:26:28 2024 +0100

    UPDATE: the game's python version is more like the html's version

commit 3a7aa4a74ec0d09e6d4cf2c670df1610f536d88c
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 14:13:43 2024 +0100

    UPDATE: disable the function saveJsonAsDownload()

commit 3cb0175e7618f8d4c02baa2eae352fac7961defa
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 13:25:35 2024 +0100

    UPDATE: clean

commit 7eacdecf594a75279493c5039b9554fb0507a70c
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 13:24:23 2024 +0100

    UPDATE: delete archives and update .gitignore

commit 8a25aae6abcaebc61140ae51fcb0a76b39dece31
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 11:58:27 2024 +0100

    UPDATE: move functions from trainaivshuman.py to ai.py

commit 937b101b63c38ab82275046ecb0497e68d78b848
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 11:33:42 2024 +0100

    UPDATE: typo

commit f60c4156eb47ef6a62d698a120e29ab2881f2b15
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 11:33:23 2024 +0100

    UPDATE: clean

commit 56aac4cb0111452f93a256e1c440eb4a6fa4c9d3
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Nov 5 11:33:09 2024 +0100

    UPDATE: clean

commit 6c2c2c804aa7beed868b68d80546b6acbb20bf73
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Nov 4 10:41:43 2024 +0100

    UPDATE: add the choose of saved AI to convert

commit b9ed27917d5b0f9c9d4fa397f4929b2718fb8334
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Oct 31 15:26:18 2024 +0100

    UPDATE: add the ai training against previous humain match

commit ee1d480756f02798758f3ddccc90617b254ae1af
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 30 16:07:52 2024 +0100

    UPDATE: save data ton json for dev's purposes

commit 0f4db30e536eade7fae7adb11cc492854c5b626e
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 29 11:29:18 2024 +0100

    UPDATE: clean

commit 6964d56c940245eda344fb5ade59853a46b3f09c
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Oct 28 19:11:09 2024 +0100

    [CI/CD] Remove separate build

commit ea913b4f39ad48cc68f7f39e381df3b717b54c45
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Oct 28 19:04:34 2024 +0100

    [CI/CD] Ensure .venv and node_modules are erased after copy

commit 2fdb11e5b7d0cf2096e924c01c3d9db90a4cb155
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Oct 28 17:55:58 2024 +0100

    [Static] Build static for daemon

commit cef9d0fdfd00e0ecb780f17108ea65823859140c
Merge: 787451d 391077a
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Mon Oct 28 17:45:29 2024 +0100

    Merge pull request #45 from LuyNagda/42-40-fix-authentication-middleware
    
    Enhance Chat Application: Logging, UI, and Sync

commit 391077a57c7d872a258fd805c3d36b52b75eb58a
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Oct 28 17:41:24 2024 +0100

    [Chat] Fix endblock

commit 4d20e0e7b0845a49a2e7907095be727f539b24d5
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 23 19:56:56 2024 +0200

    UPDATE: record the player's decisions only if he catch the ball

commit 7eace241510acc6ef21af8c5d5342862f2539975
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 23 17:50:45 2024 +0200

    UPDATE: add comment

commit d86481adabd584ec1bf93db8dcf9dcdbdbf77af4
Merge: 1c53fef 324d88a
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Oct 20 16:00:56 2024 +0200

    Merge remote-tracking branch 'origin/5-design-game-architecture' into AI

commit 324d88abb99032a1cd4208a736a91c96c7eea680
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Sat Oct 19 18:38:11 2024 +0200

    fixed update loop, queep wipin

commit 1c53fef87259bdb363894af1fe465814fbba372d
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Oct 19 18:17:10 2024 +0200

    UPDATE: add good AI and simplify the AI duel

commit e15d82a7f783bd3dcb766a1990b2f6cb512d0af4
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Oct 19 11:54:47 2024 +0200

    UPDATE: Remove useless DISPLAY_LOG

commit 5003c3c3dfe32276c4890867471942c162bec47d
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Oct 19 11:49:16 2024 +0200

    UPDATE: CLEAN

commit d8f9f48c3de5f8d9853e2a5f6be87e250fa082e8
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Oct 18 18:10:51 2024 +0200

    UPDATE: force AI to play better against straight ball

commit 8e30e399ece3ff39af31180aa46ca84791fc7ce9
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Oct 18 17:03:09 2024 +0200

    UPDATE: CLEAN

commit 4b4cdf40095aeb07cee691e4c03d7cfe1f3ec851
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Oct 18 17:00:58 2024 +0200

    UPDATE: Fix: paddle don't touch ball but the ball bounce back

commit bedee7cb302de3609dc25f96296cf2f974fc4295
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Oct 18 16:13:45 2024 +0200

    UPDATE: Remove the bug when the ball sticks to the wall

commit 872c74ab632d5113a0a85faf1a4064f8f67d9014
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Oct 18 15:19:45 2024 +0200

    UPDATE: simplify files

commit ec8f7fc87efec7717b3390912e8141c7cd5c9a6b
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Oct 17 18:03:47 2024 +0200

    add dynamic dom updater - WIP WS ROOM - TODO: fix update loop

commit 1cdc9c7719a1a2fa5451dfd435040e4c397f2048
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Oct 17 15:35:51 2024 +0200

    WIP WS ROOM reformed for bundling

commit 4acb554af585557a2faacc6b5458b8ca39b68cec
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Oct 17 14:55:15 2024 +0200

    WIP WS ROOM

commit 9bcc12e12ff36b845245694d2381d2d833e0c9d3
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Oct 17 14:19:44 2024 +0200

    WIP WS ROOM

commit 0af0ad4e39d1fb8614de8e18a43c1340828f9a01
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Oct 15 19:26:53 2024 +0200

    WIP Room management

commit 1e9261c7e0ec22cc57e205b76bd482f3868c0c65
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 19 17:08:12 2024 +0200

    add ctr screen effect to pong

commit 4e9f6df69bd5d5dfd15d858f725995040404a901
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 19 15:06:54 2024 +0200

    modif

commit c04243919fadc93e362d37cf01182505ad7276be
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 12:34:00 2024 +0200

    wip pong endpoints

commit 6d51a2b3b6065cc912dd6a0bf530e89bcb687514
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 12 16:28:55 2024 +0200

    wip pong room/game managment

commit 353ca3df24ef9953b6cfacc6ba0942b103e29894
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 18:45:48 2024 +0200

    wip pong endpoints

commit fd86d5670ce94526acae867d42c7ee79a15390e8
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 12:34:00 2024 +0200

    \wip pong endpoints

commit 4e4757954052ee3e6f2c9b92abea1f0d98a37cfb
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 16 17:47:30 2024 +0200

    UPDATE: python's game now behave like our pong

commit 384e5660fabc58542d6e85186792fd1cb9df9443
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 15 18:51:57 2024 +0200

    UPDATE: start of the migration to the final game

commit 8a8f67fa6624b534d63b50ecefd3efa2743eeccb
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 15 16:10:49 2024 +0200

    UPDATE: integrate the AI into the real game

commit c0e903ef71ab0d50a0aea64952bb21ef3a41908c
Merge: 05a23e9 639536d
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 15 11:09:18 2024 +0200

    Mergee remote-tracking branch 'origin/5-design-game-architecture' into AI

commit 66e8fac801408eccd97623c4c1c7cfc2483a51e6
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:53:17 2024 +0200

    [Theme] Fix theme switching

commit c24d436073234770e9bce586a3b3dc48a8416836
Merge: 877e5f7 787451d
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Thu Oct 10 23:46:26 2024 +0200

    Merge branch 'main' into 42-40-fix-authentication-middleware

commit 877e5f76f741e3432b777b97b24d530f6e13594f
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:37:20 2024 +0200

    [Clean] Exclude generated statics from git

commit 1aaa91b4bd58122788dd26950f7e1d8b4e2cbfa1
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:29:31 2024 +0200

    [Logs] Improve logging : add colors and fix optional user_id

commit c874f0c9253f980481df817d2a918e2638f881f6
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:28:59 2024 +0200

    [Data sync] Fix user id back-front sync

commit 419cbf815f0dd9c34d0d3dc6aa89e6520f77127b
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:26:57 2024 +0200

    [Logs] Switch frontend app logger

commit ce78aba4eee7ac4836b5d6fd9afec85bad41b763
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:05:44 2024 +0200

    [Logs] Fix DEBUG and LOG_LEVEL env settings

commit 2b23e5134df7ee0435e71f265d8eeed8ec06dba6
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Oct 10 23:04:40 2024 +0200

    [CI] Rebuild on .env change

commit 05a23e93d7e309bbffe2dad3090da68d0f7223d1
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 8 18:18:29 2024 +0200

    UPDATE: add new trained AI

commit 68b3149af37a58d13d89682a3330f0adc0d40b23
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 17:50:41 2024 +0200

    UPDATE: fix error caused by the modification of the NNAI.js' name

commit 6118c579ef3a0528abf8e98e95463b8a0409be0c
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 17:09:03 2024 +0200

    UPDATE: rename NNAI.py to ai.py for consistancy

commit e1e28049644afa27f11168e30892ff318ff3dd27
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 17:07:46 2024 +0200

    UPDATE: clean

commit 310caaa93141467a8200bc060de152112b1ee2a8
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 17:07:06 2024 +0200

    UPDATE: fix paddle position send to AI: now send relative position

commit 35f24bf78d88c69922eccf6b95223b11837df507
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 16:58:56 2024 +0200

    UPDATE: simplify code (move AI_decision() into the class Neuron_Network)

commit 81fcd701d9ac2aede1be2cf2b13fc881a8168c69
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 16:40:55 2024 +0200

    UPDATE: add favicon

commit 91ffb13e88fda2f91b8fb6a7cdce01e409fbaa54
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 14:34:17 2024 +0200

    UPDATE: simplify code (move AI_decision() into the class Neuron_Network)

commit b9ae0eb4aef32599d6480383701affa460ca24c3
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 13:50:41 2024 +0200

    UPDATE: simplify code (Neuron_Network's class and AI_decision function)

commit 280dd6ac149b05552c554d5f1a65fe0ff2b079b3
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Oct 7 13:32:01 2024 +0200

    UPDATE: add forward function in Neuron_Network

commit c690d9eb43b8f384fb0c65e9961ca589537da3af
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Oct 3 17:19:07 2024 +0200

    UPDATE: add a delay for the AI's view

commit 953ef0b1a7c2426bd8ca4c2aaff12d10951ad4fa
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 2 16:03:52 2024 +0200

    UPDATE: AI in pong.js

commit 31477c54cb63cd7bc7d0490f192bbb2e1727981b
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 2 16:00:52 2024 +0200

    UPDATE: FIX typo

commit 64678619b76e3c7740b73c7311c26cc8cf107a4a
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Oct 2 15:52:39 2024 +0200

    UPDATE: the game throw the ball randomly

commit 4fe9f1a13f09f41e3ec15658ffe9570b6921d627
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Oct 2 00:59:23 2024 +0200

    [User] Trying to htmx trigger user data update in DOM

commit 91b1c8a30f20edc22226157b7f801badd9ad0596
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 1 19:43:19 2024 +0200

    UPDATE: CLEAN for debugging

commit 68a3a3204da2f58bf2aa5546acf0d4fbf8037d49
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Oct 1 19:28:28 2024 +0200

    UPDATE: trying to debug AI in pong.js

commit 8a255751ef7d6a5a75b67520afe2887bc702efb5
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Sep 30 10:19:33 2024 +0200

    UPDATE: prototype try AI in pong.js

commit 787451d8a64e0a6b190e1c9a5272440aebb8e520
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Sun Sep 29 15:14:02 2024 +0200

    Fix Chat Canvas Closing

commit 985fe61d7343c50e9777e145d9e8ed7fef3d1140
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Sep 29 04:27:31 2024 +0200

    [Chat] Fix tests

commit 069307e1f67b8525dc3d2dbb6199cc961ae453c6
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Sep 28 06:35:43 2024 +0200

    [esbuild] Refactor frontend app - unstable

commit 59f4e1a221171b62b02ea1b5a9f630e5377f612e
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Sep 28 04:02:26 2024 +0200

    [Chat] Beautify chat

commit cd2989f3f7a94dabfbe0315a6bb60fef63f31e5a
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Sep 28 04:00:50 2024 +0200

    [Log] Add front-end logger

commit ebf1bb6e0c00702e77c3dbaf7f457369fb59dae4
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 22:05:59 2024 +0200

    [Chat] Fix history - Add msg bubbles

commit 28570eb0de7d1843ee7f48a3479d02d76165da8b
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 22:05:00 2024 +0200

    [LOG] Add context logging

commit 6bd59d2b9a303917fa418ae1079ed9a70a43f709
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 03:57:05 2024 +0200

    [Chat] Fix main features

commit 1193a708b039d810a89f1f5a947cecdaa74f4b8a
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 02:49:47 2024 +0200

    [Chat] Fix front block / unblock

commit ecd088b164fffe57f89f28c762de3150c0f5c651
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 02:24:44 2024 +0200

    [Chat] Refactor chat auth - unstable

commit 3694be0817944ab6bd47be408ada4eeadff9c24a
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Sep 27 02:11:40 2024 +0200

    [CI] Multi-stage build : cache python deps

commit 3281a1c0e999a8a56dd4aba4d1cfc35f12a2d497
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Sep 25 22:14:13 2024 +0200

    UPDATE: finished ai.js

commit cbbd090f2bfa778c207faa6b9f4ed4aa74447dc4
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Sep 24 16:26:55 2024 +0200

    Fix Bugsnag condition

commit 6faa6e5bd4c5423ff23e039fda52ac2b4b095829
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Sep 24 12:32:39 2024 +0200

    Fix bugsnag broken change and include static

commit 32f677be731ecf14106aa816685ac81c4e45192b
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Sep 23 16:26:18 2024 +0200

    Fix bugsnag

commit 40afbd080597df986a93c7701f96b6a6e84405b4
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Sep 19 20:22:30 2024 +0200

    [CI] Refactor makemigrations - copy instead of sync

commit fafb7c145780516329b599aeea9d3e952eb9296d
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Sep 19 18:14:00 2024 +0200

    [CI] Fix dev : Streamline dev / test, rebuild on critical changes

commit 639536d7bc71d734ce9f2e164f9ebcce514973ed
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 19 17:08:12 2024 +0200

    add ctr screen effect to pong

commit baa67e40fd0a0bfa5c10ac566dc32cc60b8da280
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 19 15:06:54 2024 +0200

    modif

commit 3d7a0847cfaeac8a8bf93e47662434b6dc81597b
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Sep 19 15:02:36 2024 +0200

    Fix make dev : static and cors

commit 988367df3f960af768010b39803d9cec8198d8a9
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Sep 17 15:05:55 2024 +0200

    UPDATE: prototype ai js

commit 77085c242d1b3ebab5f4bc68cb15c359a6e20398
Merge: c98cd28 f463d5d
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 12 16:29:48 2024 +0200

    wip pong room/game managment

commit c98cd2843365ddf255190aa2a1279f3b124f65e8
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Thu Sep 12 16:28:55 2024 +0200

    wip pong room/game managment

commit f83db52190ed676f68a5bfa2c9e467e49c7a5ebf
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 18:45:48 2024 +0200

    wip pong endpoints

commit f90c11206b3913ae670de2554e36383c99e89c67
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 12:34:00 2024 +0200

    wip pong endpoints

commit 10ca5e8a7ac908c501bd83f060cd6df9a601e4bb
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Thu Sep 12 11:03:37 2024 +0200

    Add Offcanvas Chat

commit ca9a20b8914e9c70fe194802e4fd20289506233c
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Fri Sep 6 18:18:51 2024 +0200

    UPDATE: prototype ai js

commit d60266f39f61529b987ffd02fd9b2bfc4147480c
Author: agaley <agaley@student.42lyon.fr>
Date:   Wed Aug 28 01:13:26 2024 +0200

    [CI] Fix makemigrations

commit 7ec630b1e792a34b24c43a752c2434e4f18d48f9
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 29 11:46:19 2024 +0200

    UPDATE: add method to make Neuron_Network JSON serializable

commit d4658fc5cdb22dfd4644330b9c09be7d6cacaed7
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Wed Aug 28 13:53:27 2024 +0200

    UPDATE: fix ai vs ai

commit b4945e0f7d371d2240c982bf0d098917e867ef08
Merge: fe0cf36 02f2e33
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 27 15:59:29 2024 +0200

    UPDATE: add ai

commit 02f2e33e36032cb68c45290cf1077cae109d1c67
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 27 13:48:12 2024 +0200

    UPDATE: the demo is an AI vs AI

commit fe0cf3648fea8b9ced14780c097dea07f78bcea9
Author: Gauthier GALON <gauthiergalon@pm.me>
Date:   Mon Aug 26 17:52:41 2024 +0200

    Add ARIA attributes

commit fd658d43a15aa9a940b6edbce32a6ca942255991
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 26 16:40:18 2024 +0200

    UPDATE: limit the training time of the AI

commit daf8988d917ea0a83d324223eb86b6e9ff251d20
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 26 13:36:42 2024 +0200

    UPDATE: fix load AI in main

commit 6ca8026ec71a05bd67348cda1e68392735833e87
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 26 13:17:15 2024 +0200

    UPDATE: fix saved AI

commit 20e3a673c129c5a3ba90c583e7de206343e48196
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 26 09:58:32 2024 +0200

    UPDATE: fix crossover: the crossover was missing

commit e65d52f410142bde0cd11a41c6cbf2e278d32238
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 26 09:39:20 2024 +0200

    UPDATE: add crossover and mutations, and add comments

commit d2f4e1b5624476ee0ed4e0a4f7caae631c7aff61
Author: Gauthier GALON <gauthiergalon@pm.me>
Date:   Sun Aug 25 18:08:34 2024 +0200

    Fix increase Font Size and Themes

commit 466b62038b2992a26dc4f6e7e79050e16c1478a0
Author: Gauthier GALON <gauthiergalon@pm.me>
Date:   Sun Aug 25 18:02:54 2024 +0200

    Fix increase Font Size and Themes

commit ff7d892da8758aa09c085cf6f42ff495a97273d7
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Aug 25 17:06:32 2024 +0200

    [BUG] Integrate Bugsnag to internal logging

commit e15fb90e11418fbcef4f2917b87c4df8cefb9d29
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Aug 25 17:02:22 2024 +0200

    [BUG] Add bugsnag tracking for production

commit 2b55d248414c402e7a641fc0b2c755caf633c807
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 24 15:00:43 2024 +0200

    UPDATE: delete html game

commit 9cd5486ae4f77ab9b276542a073156694ac80e20
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 24 14:58:01 2024 +0200

    UPDATE: reorganized files

commit 38743d94409dc97296cfd6aa8bdf1e31e7973f77
Author: Gauthier GALON <gauthiergalon@pm.me>
Date:   Fri Aug 23 23:29:02 2024 +0200

    Add Font Zoom, Need some adjustments

commit 1051efc138ddd5d3b672f09fe9f33ddc7aee9c63
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 22 16:26:47 2024 +0200

    UPDATE: clean

commit d4f77659c39d1854b535a98084cf1ed0b8e4d9ca
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 22 16:04:05 2024 +0200

    UPDATE: clean comments

commit 0632301a228d67c75a0bef4fcaf3aa8a9e4249b8
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 22 16:00:28 2024 +0200

    UPDATE: clean

commit f463d5d73a4630f51557f45408623dc413b08557
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 18:45:48 2024 +0200

    wip pong endpoints

commit 3617e9d0dacb680d9cb263fa8bf0bbc724ec1201
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 20 17:58:11 2024 +0200

    UPDATE: add some launch option

commit cf9d1847763ac60fa0fc1ea4b3f2729bea393873
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 20 17:57:49 2024 +0200

    UPDATE: save some AI

commit 76977aab054cebcb5362b6a6b13efe87bd65c89c
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Tue Aug 20 13:42:07 2024 +0200

    Add Dark and High Contrast Theme and Bootstrap locally

commit 7732184d660c3e9584e6254e7e1ea3670147bb0a
Author: ZEDIUM-Off <matisse.chenavas@gmail.com>
Date:   Tue Aug 20 12:34:00 2024 +0200

    wip pong endpoints

commit 484f5810415451bb02607fac53a06f9b095f6454
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Mon Aug 19 17:33:53 2024 +0200

    Update chat frontpage

commit 02e9f61a311d91ef20e88c6b2c1515b9b48add04
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:20:01 2024 +0200

    UPDATE: gitignore

commit 9a48940512fcaf01862fdf510b23633d3b07d602
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:19:17 2024 +0200

    UPDATE: gitignore

commit eca130cdbedf10735795c7dde468422e1537c2eb
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:17:59 2024 +0200

    UPDATE: move saved AI in a folder

commit 024c992f9348af0f22fcca3cf8ce59a07a65fb1c
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:17:30 2024 +0200

    UPDATE: add the possibility to play vs an AI

commit e703fca43edff24b63bd1b21e0fcab3b48b785ac
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:16:33 2024 +0200

    CLEAN: delete useless files

commit d5dc892baf43ca5469231c7fc8fb25663cdaa375
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:15:49 2024 +0200

    UPDATE: add a .gitignore

commit af84d16175c6213e70c2387365e6ecb00a088184
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Mon Aug 19 15:15:17 2024 +0200

    UPDATE: archived some files

commit 2bad59601d9e550b668f214360ea97ec3b115b1e
Merge: 2a832e4 f77a6b6
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Aug 18 16:16:47 2024 +0200

    Merge branch 'main' of github.com:jmoutous/Pong-AI

commit 2a832e43f508ea18e550b21635d1fedb49efa7b9
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Aug 18 16:15:46 2024 +0200

    UPDATE: save some test

commit f77a6b60a93bdcd07a46bf3e067b2a27e8c86ce4
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Sun Aug 18 16:12:16 2024 +0200

    UPDATE: opti for trainning

commit 5b83a7e4430c7d6028c7408f7be2c797790f4190
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Sun Aug 18 16:11:03 2024 +0200

    UPDATE: add some promissing AI after 110 generations

commit 11a76d2ba89dab9ed5b15d13cee4f5bac25931aa
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Sun Aug 18 16:04:49 2024 +0200

    CLEAN

commit 6d0b1e50b2eb0bc372898d40a83646100e5b52c8
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Aug 18 14:27:29 2024 +0200

    UPDATE: only use one layer of 3 neurons

commit edd2b408e34f3ec65c8713d3cdd0391c96024d84
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Aug 18 14:26:39 2024 +0200

    FIX: wrong ball input was send to the AI

commit 7ac37e44e419793d32ab59bdfa3b5e187efa7dd7
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sun Aug 18 13:51:20 2024 +0200

    UPDATE: improve clarity with defined variables

commit 4dcbd31daf77ad172aff98c2c60ff5fcfe4a6492
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 18:31:02 2024 +0200

    DELETE: main.py was useless

commit 2cd5e7425a690e5f2b563e054a0259b2f55adda2
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 18:30:20 2024 +0200

    UPDATE: Mix the 5 bests AI

commit cc2a71453cee0b8539801df1dd9a2e4cfce607ff
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 17:45:46 2024 +0200

    UPDATE: save the 5 best performing AI

commit 600c4066078fd37b6a31fb1748f62c2498a5add1
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 17:45:07 2024 +0200

    UPDATE: reduce the number of neurons

commit c13c884ee17e02c5c86ad063d71a4cb40acf43f8
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 11:08:59 2024 +0200

    UPDATE: creat 10 random AI and test them

commit f2d29495b034237c3d013bef9dc7bc7252467801
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 08:04:15 2024 +0200

    UPDATE: AI decision is move to a separate file

commit 77465ef1a624a0a29fd865b0d123d1e7e8ba1e1a
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 07:46:44 2024 +0200

    UPDATE: improved the game

commit 5ae7dd07751ed19ba6bc29785a718fd630208365
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 07:34:57 2024 +0200

    UPDATE: the opponent now can see the game once a sec

commit 340faba645da3b0009dea819821463c63178fe35
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Sat Aug 17 07:08:53 2024 +0200

    UPDATE: add a simple pong game in python

commit 914d49ea2fc0d7fbe2538dccc7eddf7c516844a0
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 15 17:57:34 2024 +0200

    PROTOTYPE: pong.py

commit f13467668dbe9c89cd2722c3365b1acbf1badf12
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Aug 15 20:31:51 2024 +0530

    Fix: minor issue with 42 api login

commit cc492249aae96206a65da74512bb857e3c9427a2
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Thu Aug 15 16:14:29 2024 +0200

    Add notifications badges

commit 6ba84613d3afb6c5dc60ac0d687486744f6916cd
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 15 14:21:01 2024 +0200

    ADD: first prototype of a neural network

commit bd75cf0a38acdd072ab14abbeb0be203d419b866
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 15 14:15:38 2024 +0200

    UPDATE: add more comments

commit 8e891b95279c19eede39642006a4c34ea872d491
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Thu Aug 15 14:15:06 2024 +0200

    UPDATE: clean

commit a4cc4a234de31460da44ca2604629a27f3d233e6
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 13 19:05:01 2024 +0200

    UPDATE: add SoftMax

commit 22bb5630a0256420048425b67cb52719c6be266a
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 13 17:09:38 2024 +0200

    UPDATE: add comments

commit 84f6a215193d2c51551f91cafdf3ac570b7262cb
Author: jmoutous <julien.moutoussamy@gmail.com>
Date:   Tue Aug 13 17:01:29 2024 +0200

    UPDATE: prototype Neural Network

commit 29550244aadac4a7258b8a18b1c7b10ec039be69
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Aug 12 22:04:20 2024 +0200

    [42api] Env variables

commit 6628fcc68bb4b3dbed47f10e51a59e802d7716e6
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Aug 13 01:10:41 2024 +0530

    Fix: chat classes and add db-clean to make fclean

commit b556511ccb8188369e2b7e1df33f5a539bc0086d
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Aug 9 13:57:03 2024 +0530

    Fix: not setting user online as it's handled by alex already

commit dffbef0529af8f090c8033b282d526c6a2a8f5e0
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Aug 9 12:55:29 2024 +0530

    Fix: add refreshing of access_token when expired

commit 0d2c5753db758eafd43c5623ba1c9b48d7ce4f83
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Aug 9 09:43:53 2024 +0530

    Remove hx-headers as it's useless now

commit da14ca921625ca09c207a00a23ea9f7f825e1c7d
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Aug 9 09:38:25 2024 +0530

    Fix: csrf invalid domain
    
    Fix: favicon not found
    
    Fix: add protection before deleting cooking on register and login pages

commit dd7b1d5232a6e73a3d80cf4e49a64edbc5915b38
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Thu Aug 8 17:22:41 2024 +0200

    Add set password frontpage

commit 7926fd3b199ae589ceeeff6ef1ea1aa2766dd14a
Merge: 3cf1774 0ded649
Author: gogo <72768800+gogolescargot@users.noreply.github.com>
Date:   Thu Aug 8 17:04:36 2024 +0200

    Merge pull request #41 from LuyNagda/jwt-fix
    
    Update: JWT authentication with cookies

commit 3cf1774dda70edd02cb75273793b1300bfd9c473
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Thu Aug 8 17:02:22 2024 +0200

    Add chat pages and footer

commit 0ded6494e2e8f6617df65a0fa0c6afb8cf68f01a
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Aug 8 13:39:58 2024 +0530

    Update: JWT authentication with cookies
    
    Update: JWT with expiring tokens and refresh enabled
    
    Misc fixes

commit 8e5c7978c716ef593c3995237a983878c39ae171
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 21:21:49 2024 +0530

    Fix: add jwt conditions to chat

commit 9afa8e42fe6eb0a254dd7bf47880cc24b58f568e
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Wed Aug 7 17:41:11 2024 +0200

    Add chat navbar button

commit 143b443818d72f83c925bd1f0952b21faa4f531b
Merge: ae8b8fa 68d676b
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Aug 7 17:30:07 2024 +0200

    Merge pull request #38 from unkn0wn107/main
    
    Live chat

commit 68d676bf4954790230f005ed2bd10d1561a20c1b
Merge: 6383074 ae8b8fa
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Aug 7 17:28:50 2024 +0200

    Merge branch 'main' into main

commit ae8b8fac31f18e3179c006d5ecb70c13b8cbeab6
Merge: 38c3846 a998098
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Aug 7 17:14:22 2024 +0200

    Merge pull request #40 from LuyNagda/luyforlyon/42-30-implement-jwt-system-wide
    
    Luyforlyon/42 30 implement jwt system wide

commit a998098d4de5faefd767dff52d0362bb6b8f127a
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 20:42:38 2024 +0530

    Fix: issues when login username is not present in db

commit d982ba546c9f9ef054e10f40f4c79e2424a8182a
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 20:27:27 2024 +0530

    Fix: another commit for fixing merge issues

commit 551efa6074cb59ffdcb843b56eb6cf4a84b6d51c
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 19:54:00 2024 +0530

    Fix: minor issues due to merge

commit ed2f3da79538738f5b36b973164676c7610840c0
Merge: 430657b 1b5e78b
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 19:39:35 2024 +0530

    Merge branch 'ggalon' into luyforlyon/42-30-implement-jwt-system-wide

commit 430657b82a196b41d222b03a39c3fa4db8dad6a6
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 17:06:35 2024 +0530

    Fix: redirection to login when not authorized
    
    Fix: deleting cookies when visiting login/register
    
    Cleanup unused functions

commit 514e8cc6e220cb58ff1cb2986ffdda7779233557
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 13:46:45 2024 +0530

    Fix: add set password for API users

commit 61bba8d89f1c0b8a724eaa2360a42c397e1a6756
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 13:33:58 2024 +0530

    Add: OAUTH 42 API

commit 367707e978e596088bba650e6f630c30698c29cf
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 12:21:02 2024 +0530

    Cleanup

commit 1c16f4cfe30b6dc16dafea563a89cfd88d13ac52
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Aug 7 10:58:41 2024 +0530

    Add: JWT authentication system

commit d3d1bdd6c4a5056b38ec505e1a7d6bfbc1c3e6f6
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Mon Aug 5 18:00:51 2024 +0200

    UPDATE: add direction of the ball and refresh it every second

commit 61c0d9d5cd65d12792632f2ec163cb44586ba692
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Mon Aug 5 17:54:22 2024 +0200

    UPDATE: add direction of the ball and refresh it every second

commit a8e0f5111a4e21b5a826351eea0f54dbaaa2e47b
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Mon Aug 5 17:42:50 2024 +0200

    UPDATE: add poistion of the ball and refresh it every second

commit 638307416baa838c501d5c8fae353a9e37e1391a
Merge: 97129a3 7701031
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Fri Jul 26 23:18:59 2024 +0200

    Merge pull request #4 from unkn0wn107/https
    
    [HTTPS] Domain as env for settings

commit 7701031ccc8a946fb0065e256249b2717eb42a1b
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 26 23:17:19 2024 +0200

    [HTTPS] Domain as env for settings

commit 97129a3be8d5e1edc8dc36bf77933802e1e481ec
Merge: 65861dc ef3ef94
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Fri Jul 26 22:38:45 2024 +0200

    Merge pull request #3 from unkn0wn107/chat
    
    [HTTPS] Set-up https configs

commit ef3ef94ef268a67d5195dc293c8ff0beab6fb2bc
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 26 22:37:45 2024 +0200

    [HTTPS] Set-up https configs

commit 65861dc3a4b49a67779fb0148bcdef94c08808ef
Merge: d8326ed dbb1ea1
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Thu Jul 25 23:33:55 2024 +0200

    Merge pull request #2 from unkn0wn107/chat
    
    [Chat] Add message recovery queue

commit dbb1ea19aef54e927df0df2928ca82d4528d422f
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jul 25 23:32:37 2024 +0200

    [Chat] Add message recovery queue

commit d8326edf2cf7ce42b40dcdce9deab3a10789ea8f
Merge: 3f01a6d e8a159d
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Thu Jul 25 22:29:49 2024 +0200

    Merge pull request #1 from unkn0wn107/chat
    
    Working live chat

commit e8a159d997af34486fb4869cf5563a10dd7f66b0
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jul 25 22:09:24 2024 +0200

    [Chat] Working live chat

commit 01e6f04fa18e806bb4b81f1786f294bda3095687
Author: agaley <agaley@student.42lyon.fr>
Date:   Thu Jul 25 05:05:48 2024 +0200

    [Chat] Core - ws not working

commit cb89a33e88c42e8a344a1ce9da5e0d36bc99d6e3
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Jul 24 15:52:32 2024 +0200

    UPDATE: left side invincible because of big paddle

commit 35afdd61224410c8a0f495cc57870a0a3f1d09bf
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Jul 24 13:06:09 2024 +0200

    UPDATE: fix: export canvas

commit 33420ddd782117798c1a9210cd5f4ce5fe570d2f
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Wed Jul 24 13:04:22 2024 +0200

    UPDATE: add prediction function

commit 8057d9248c9ecb58de4417622f4386c245765723
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Tue Jul 23 17:59:23 2024 +0200

    UPDATE: ai control are in a separated file

commit 467dbc62df10bb4a95e5cb184288f263cfc1f872
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Jul 22 19:59:45 2024 +0200

    UPDATE: simplify for dev

commit b2762fdb8ecb09be90e31c87a36303f3eaa9ed70
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Jul 22 18:04:01 2024 +0200

    UPDATE: ai refresh his view every second

commit b6f48e96e1c304994024345d6e8868fb47f35291
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Mon Jul 22 17:43:22 2024 +0200

    UPDATE: player can't lose for dev purpose

commit 1b5e78b1e346a6b6a7e2f9042806fdc9091500b0
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Sat Jul 20 08:54:14 2024 +0200

    Add change password frontpages

commit ccb15e6763c29891eaf82b020d174bd1d089d2ce
Merge: 19e65f1 38c3846
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Sat Jul 20 08:46:40 2024 +0200

    Merge commit '38c3846' into ggalon

commit 38c3846fa11215614cbf9da20805f9a911eb3102
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jul 19 21:44:31 2024 +0200

    Add: form-control to change-password

commit 5d18e418f6021c099c8bd36640a852121a677ba1
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jul 18 18:19:49 2024 +0200

    UPDATE: add pause button and slider's function

commit dc1a64d0cd9fe797961a1744bcf4af3e0267a626
Author: Julien Moutoussamy <julien.moutoussamy@gmail.com>
Date:   Thu Jul 18 13:18:34 2024 +0200

    UPDATE: add slider for opponent

commit 6dcd94193f6e34137d2cb9c9a59ac40352fc1f7b
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Jul 17 18:19:54 2024 +0200

    UPDATE: add start button

commit 7668300d6db696536c87f7f5e98d327369f01c37
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Jul 17 17:42:20 2024 +0200

    UPDATE: add acceleration to the ball

commit 8973b7066e1d35837419a1924d0bf93b0f90fa98
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Jul 17 17:30:10 2024 +0200

    ADD: basic AI opponent

commit 86ccb6963bac4321dc4bc46c8ab37860b6e0b6fa
Author: jmoutous <jmoutous@student.42lyon.fr>
Date:   Wed Jul 17 17:13:45 2024 +0200

    ADD: basic pong

commit 19e65f1722d72daca3938d789feb76bdba496b23
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Tue Jul 16 06:12:27 2024 +0200

    Fix profile frontpage

commit 51f31b8b0b05c88b79f6d40a359e496722596fb0
Merge: e89b841 3f01a6d
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Tue Jul 16 05:39:14 2024 +0200

    Merge branch 'main' into ggalon

commit e89b841e5a3034838962d0b890e681f83cb785f4
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Tue Jul 16 05:38:34 2024 +0200

    Add edit profile and settings frontpages

commit 960f833c1d67630f2df067111c6f5ffd0e3722ca
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Sun Jul 14 09:50:31 2024 +0200

    Add login and register frontpages

commit 25ab45b70ad037a1115ab43bd49f04efe83ff2b2
Author: gogolescargot <gauthiergalon@pm.me>
Date:   Sat Jul 13 08:07:01 2024 +0200

    Add navbar and fix Makefile

commit 3f01a6d295c8d521259bfccdc6752111256fecaf
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 13 01:41:48 2024 +0200

    [CI/CD] BREAKING env : see example. Traefik and env thingy

commit ab384caf7c92cd0709a1f41b0d7af41d35c35e06
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 13 00:39:06 2024 +0200

    [CI/CD] Add domain add debug

commit 537c083e50d66ebbdf66119f612491aab1d417bf
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 13 00:04:25 2024 +0200

    [CI/CD] Traefik routes on 8000

commit 392ac5c465254d653be7851fa7f567b52be52595
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 13 00:00:40 2024 +0200

    [CI/CD] Enables https only

commit 153a8fb4a289fa2b3a5ec730b635f60c0dc476bb
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 12 23:54:03 2024 +0200

    [CI/CD] Cond containers to native profile

commit 21d918f1081a8bcc40a683279e72e0450a46c210
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 12 23:31:42 2024 +0200

    [CI/CD] Fix env var syntax

commit 99863dcb212f6cd186586a02483ae7911abbdad9
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 12 23:26:09 2024 +0200

    [CI/CD] Add traefik let's encrypt layer

commit 122490ab8d666de529814586a9fb0c688cb6ac92
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 12 23:12:45 2024 +0200

    [CI/CD] Fix action version

commit db3eb0922be9c81d893d04b7a1a71c7fff950682
Author: agaley <agaley@student.42lyon.fr>
Date:   Fri Jul 12 23:10:18 2024 +0200

    [CI/CD] Auto-deploy prod

commit 0f7d426fb6b7e7ffc14973cdc80f01254fbf8120
Merge: 20b8ee6 0e8a87a
Author: LuyNagda <luy2709@yahoo.com>
Date:   Fri Jul 12 18:06:44 2024 +0200

    Merge pull request #27 from LuyNagda/luyforlyon/42-24-fix-profile-photo
    
    Luyforlyon/42 24 fix profile photo

commit 0e8a87ac9b76ee75ac5e639d5c7c115dd8d17f00
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jul 12 18:03:51 2024 +0200

    Redirect to index if logged in

commit f800217d696313ab9cc3ac96ee20accee919f7c9
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jul 12 18:02:39 2024 +0200

    Fix: add encoding to all forms

commit dc6be5556a2512f51840303367915cc21b3cd95d
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jul 12 17:57:26 2024 +0200

    Fix: issues with profile photo

commit 03331d551025e31a61e58ff3a4cc46fd65599914
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jul 11 01:25:49 2024 +0200

    Add: functionality for 2fa

commit de0a33a722e2559ef6665a5cb6f37fa23f41d599
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 23:56:37 2024 +0200

    Add: support for change password

commit bb78dbe3954bf884798f04196f8211cb379cf3b5
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 23:06:17 2024 +0200

    Fix: linking system for forgot-password

commit 20b8ee68fe166a44b2c9e63ea21d002c8167c47b
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 22:02:40 2024 +0200

    Removing redundant tests

commit 464bae9744d089b6dc5bb502d0e4f4cfd70cf927
Merge: 4a926ed bc6841d
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Jul 10 21:53:33 2024 +0200

    Merge pull request #25 from LuyNagda/luyforlyon/42-28-fix-show-proper-error-when-user-trying-to-access-pages-not
    
    Luyforlyon/42 28 fix show proper error when user trying to access pages not

commit bc6841dfa2f3bc359571b98632fa0ae94e792547
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 20:15:23 2024 +0200

    Fix: redirecting without get parameters to login page if user is unauthenticated

commit e8b57d1853c7bad15174cc5b7999d3918d837c92
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 20:09:01 2024 +0200

    Fix: link redirection to login page when a user is not authenticated
    
    Remove redundant code

commit 4a926ed4cc11203453d289820bb866969ecbce01
Merge: 23e21ca 0edfc75
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Jul 10 19:50:02 2024 +0200

    Merge pull request #23 from LuyNagda/luyforlyon/42-27-fix-working-on-back-and-front-buttons-on-browser
    
    Fix: front and back buttons on browsers

commit 0edfc7588cbe137b391bf038651ed22f59251e25
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 19:46:25 2024 +0200

    Fix: front and back buttons on browsers

commit 23e21cabc2f3e76458cd8fb942aae0c063fc30df
Merge: e11f9e9 7d815db
Author: LuyNagda <luy2709@yahoo.com>
Date:   Wed Jul 10 18:57:51 2024 +0200

    Merge pull request #21 from LuyNagda/remove-useless-code
    
    Fix: redirecting user from register to login when already known

commit 7d815db382c68b9e7f973485a7dc216712c28b70
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 10 18:55:36 2024 +0200

    Fix: redirecting user from register to login when already known

commit e11f9e97df177155aaeaf00b27d26a50b2bc0031
Author: agaley <agaley@student.42lyon.fr>
Date:   Tue Jul 9 23:38:14 2024 +0200

    [make] Fix build

commit f03d53b4999f97d47bbbecbef0c59c27bfac9488
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 02:31:09 2024 +0200

    [Test] Fix verbosity

commit 30671df4375714da2845c03e96bdffecce8643a3
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 02:21:41 2024 +0200

    [CI] Force source in run cmd

commit ad8470ac4027b611db2ad079ca6257263dd88b87
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 02:20:42 2024 +0200

    [CI] Fix shell bash

commit a99094fcfaaf83852e8e81276ce0031b1711625a
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 02:16:47 2024 +0200

    [CI] Fix env

commit 8fa3416b7dd5ab494c0d2bff0341567ed9b9aa6e
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 02:05:42 2024 +0200

    [Tests] make test + CI

commit faf59b06827d5834b1b21ee7df78f61ac95b5a9b
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 01:24:45 2024 +0200

    [Dev tools] Fix env setting

commit 2155a24b17143be3e437a7d825b8d5bd3c3bba71
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 01:03:51 2024 +0200

    [Dev tools] Banger make !

commit f722e43b271ccad43b71395d05c3b037ca74b526
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Mon Jul 8 00:25:44 2024 +0200

    Update README.md

commit 8a135d94e0139cabd4142d7e2c4b7e4fc3491572
Merge: e387a63 2800a10
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Mon Jul 8 00:24:19 2024 +0200

    Merge pull request #3 from LuyNagda/alex/dev-tools-fix-variables
    
    [Dev tools] Fix .env, postgres, healthcheck. now use : make

commit 2800a10ccf1e40bd312146a13712f25176778094
Author: agaley <agaley@student.42lyon.fr>
Date:   Mon Jul 8 00:22:32 2024 +0200

    [Dev tools] Fix .env, postgres, healthcheck. now use : make

commit e387a630dacd2ff920dab287cc31f787337bd43f
Merge: e655f66 7b61521
Author: unkn0wn107 <108351913+unkn0wn107@users.noreply.github.com>
Date:   Sun Jul 7 23:02:50 2024 +0200

    Merge pull request #2 from LuyNagda/alex/dev-tools
    
    Alex/dev tools

commit 7b615215796f3494f5b8ce41914f857a2c9b9d35
Author: agaley <agaley@student.42lyon.fr>
Date:   Sun Jul 7 22:52:51 2024 +0200

    [Dev tools] Fix WORKDIR

commit 7a9c63dfabe67d841f7a4288fcdc6b87f72a0ae5
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 6 01:39:36 2024 +0200

    [Dev tools] Fix migrate at runtime

commit ede9558784641191a61e0f3b82bc982d2be7e4aa
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 6 01:26:11 2024 +0200

    [Dev tools] According to readme commands

commit c97471cb335cd45084ba575c7ca4f3e8dfe0a2ef
Author: agaley <agaley@student.42lyon.fr>
Date:   Sat Jul 6 01:15:07 2024 +0200

    [Dev tools] Add make and docker - not running

commit e655f668bd9a6b83c21300e50ecfa978918e1c14
Author: LuyNagda <luy2709@yahoo.com>
Date:   Fri Jul 5 23:34:30 2024 +0200

    Create README.md

commit bd13aca685274f4b7d513870bcbbeb1024ebb6cb
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Fri Jul 5 09:51:40 2024 +0200

    Add: forgot password functionality

commit 3b7239c4f99b3204cef6e8fd8395722c116458ed
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Thu Jul 4 14:13:08 2024 +0200

    Add: profile view

commit ad0d65d2a0b8ac05f6cb62348a472dbd1aca3add
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Wed Jul 3 13:04:42 2024 +0200

    Add: functionality to logout
    
    Add: Auto change to login page if user is known

commit a9927bb2843f88f2c8f73cecc29ebdc54ead5937
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Jul 2 17:12:09 2024 +0200

    Fix: rendering htmls instead of redirection to not change the link

commit 469c38be8202bcd06fd9ab0c7653bbd6bb0b6e87
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Jul 2 16:46:18 2024 +0200

    Add: authentication system

commit dee050f811c5d599b7609e36eb3bdb7bed59d4a2
Author: Luy Nagda <luy2709@yahoo.com>
Date:   Tue Jul 2 15:45:57 2024 +0200

    First push
