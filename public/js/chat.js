$(document).ready(function () {
    var socket = io();

    socket.on('connect', function () {
        console.log(socket);
    });

    socket.on('userList', function (friendList) {
        var friendListGenerator = "";
        friendList.forEach(function (friend) {
            var status = friend.status;
            friendListGenerator += "<li class='contact' id='user-" + friend._id + "'><div class='wrap'><span class='contact-status " + status + "'></span><img src='" + friend.userImage + "' alt='' /><div class='meta'><p class='name'>" + friend.fullName + "</p><p class='preview'>Lets Chat</p></div></div></li>";
            $("#search-" + friend._id).remove();
        }, this);

        $("#friends-list").html(friendListGenerator);
    });

    socket.on('newMemberOnline', function (friend) {
        $("#" + friend._id + " > .wrap > span").removeClass('Offline');
        $("#" + friend._id + " > .wrap > span").addClass('Online');
    });

    socket.on('newMemberOffline', function (friend) {
        $("#" + friend._id + " > .wrap > span").removeClass('Online');
        $("#" + friend._id + " > .wrap > span").addClass('Offline');
    });

    socket.on('rejectFriendRequest', function (rejectId) {
        console.log(rejectId);
        if ($("#search-" + rejectId)) {
            $("#search-" + rejectId).remove();
        }
        if ($("#request-" + rejectId)) {
            $("#request-" + rejectId).remove();
        }
    });

    socket.on('newFriendRequest', function (friendRequest) {
        console.log(friendRequest);
        var friendRequestListGenerator = "";
        if (friendRequest.length !== 0) {

            friendRequest.forEach(function (friend) {
                var status = friend.status;
                friendRequestListGenerator += `<li class='contact' style='cursor:auto' id='request-${friend._id}'>
            <div class='wrap'>
            <span class='contact-status ${status}'></span>
            <img src='${friend.userImage}' alt='' />
            <div class='meta'>
            <p class='name'>${friend.fullName}</p>
            </div>
            <button class='btn btn-xs btn-success' style='margin-top : 5px;' data-toggle='modal' data-user='${friend.fullName}' data-id='${friend._id}' onclick='acceptFriend("${friend._id}","${friend.fullName}")'>Accept</button>
            &nbsp;
            <button class='btn btn-xs btn-danger' style='margin-top : 5px;' data-toggle='modal' data-user='${friend.fullName}' data-id='${friend._id}' onclick='rejectFriend("${friend._id}","${friend.fullName}")'>Reject</button>
            </div>
            </li>`;

            }, this);
        }

        $("#friend-request").html(friendRequestListGenerator);

    });

    $("#search-filter").keyup($.debounce(500, function (e) {
        if ((e.which <= 90 && e.which >= 48) || e.which == 8 || e.which == 46) {
            $.ajax({
                method: "GET",
                url: "/search_friends/" + this.value
            })
                .done(function (friendSearchResults) {
                    var friendListGenerator = "";
                    if (friendListGenerator !== 0) {


                        friendSearchResults.forEach(function (friend) {
                            console.log(friend.status);
                            var status = friend.status;
                            friendListGenerator += `<li class='contact' style='cursor:auto' id='search-${friend._id}'>
                            <div class='wrap'>
                                <span class='contact-status ${status}'></span>
                                <img src='${friend.userImage}' alt='' />
                                <div class='meta'>
                                    <p class='name'>${friend.fullName}</p>
                                    <p class='preview'>Lets Chat</p>
                                </div>`
                            if (friend.requestSent == 0) {
                                friendListGenerator += `<button class='btn btn-xs btn-danger' id='accept-${friend._id}' style='margin-top : 5px;' data-toggle='modal' data-user='" + friend.fullName + "' data-id='" + friend._id + "' onclick='addFriend("${friend._id}","${friend.fullName}")'>Add Friend</button>
                            <a class='btn btn-xs btn-default' style='visibility:hidden;' id='sent-${friend._id}' style='margin-top : 5px;'>Request Sent</a>`
                            } else {
                                friendListGenerator += `<a class='btn btn-xs btn-default' id='accept-${friend._id}' style='margin-top : 5px;'>Request Sent</a>`
                            }
                            friendListGenerator += `</div></li>`;
                        }, this);
                    }
                    $("#friends-search").html(friendListGenerator);
                })
                .fail(function (err) {
                    console.log(err);
                });
        }

    }));



});


function addFriend(friendId, friendName) {
    console.log(friendName);
    console.log(friendId);
    if (confirm('Do you want to send request')) {
        $.ajax({
            method: "GET",
            url: "/add_friend/" + friendId
        })
            .done(function (friendReqSentData) {
                $("#accept-" + friendId).css('display', 'none');
                $("#sent-" + friendId).css('visibility', 'visible');
                console.log(friendReqSentData);
            })
            .fail(function (err) {
                console.log(err);
            });
    }
}


function acceptFriend(friendId, friendName) {
    if (confirm('Do you want to Accept?')) {
        $.ajax({
            method: "GET",
            url: "/accept_friend/" + friendId
        })
            .done(function (friendAcceptData) {

                console.log(friendAcceptData);
            })
            .fail(function (err) {
                console.log(err);
            });
    }
}

function rejectFriend(rejectId,rejectName) {
    if (confirm('Do you want to Reject?')) {
        $.ajax({
            method: "GET",
            url: "/reject_friend/" + rejectId
        })
            .done(function (friendRejectData) {
                console.log(friendRejectData);
            })
            .fail(function (err) {
                console.log(err);
            });
    }
}